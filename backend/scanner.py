"""czkawka_cli wrapper — scan management with async subprocess invocation."""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

from models import ScanOptions, ScanProgress, ScanRequest, ScanResult, ScanStatus, ScanType

CZKAWKA_BIN = os.getenv("CZKAWKA_BIN", "/usr/local/bin/czkawka_cli")
SCANS_DIR = Path(os.getenv("CONFIG_DIR", "/config")) / "scans"


def parse_text_output(text: str, scan_type: ScanType) -> list[dict]:
    """Parse czkawka_cli text output when --json is not available.

    czkawka_cli text output format varies by scan type, but generally:
    - Groups are separated by blank lines
    - Duplicates: groups of file paths with sizes
    - Empty dirs/files: one path per line
    - Similar images: groups with similarity info

    Returns a list of groups/items parsed from the output.
    """
    if not text or not text.strip():
        return []

    lines = text.strip().splitlines()

    # Simple types: one item per line (empty dirs, empty files, temporary, symlinks, bad-extensions, broken)
    simple_types = {
        ScanType.EMPTY_DIRS,
        ScanType.EMPTY_FILES,
        ScanType.TEMPORARY,
        ScanType.SYMLINKS,
        ScanType.BAD_EXTENSIONS,
        ScanType.BROKEN,
    }

    if scan_type in simple_types:
        items = []
        for line in lines:
            line = line.strip()
            if not line or line.startswith("----") or line.startswith("Found") or line.startswith("Searching"):
                continue
            items.append({"path": line})
        return items

    # Group-based types: duplicates, similar-images, similar-videos, similar-music
    # Groups are separated by blank lines. Within a group, each line has file info.
    groups: list[dict] = []
    current_group: list[dict] = []

    for line in lines:
        line = line.strip()

        # Skip header/summary lines
        if not line or line.startswith("----") or line.startswith("Found") or line.startswith("Searching"):
            if current_group:
                groups.append({"files": current_group})
                current_group = []
            continue

        # Try to parse file entries - common format: "SIZE - PATH" or just "PATH"
        file_info: dict = {}
        # Match pattern like "123456 - /path/to/file" or "123.45 KB - /path/to/file"
        size_path_match = re.match(r'^(\d+(?:\.\d+)?(?:\s*[KMGT]?B)?)\s*-\s*(.+)$', line)
        if size_path_match:
            size_str = size_path_match.group(1).strip()
            file_path = size_path_match.group(2).strip()
            # Try to parse numeric size
            try:
                file_info["size"] = int(size_str)
            except ValueError:
                file_info["size_str"] = size_str
            file_info["path"] = file_path
        else:
            file_info["path"] = line

        current_group.append(file_info)

    # Don't forget the last group
    if current_group:
        groups.append({"files": current_group})

    return groups


class ScanManager:
    """Manages czkawka_cli scan lifecycle."""

    def __init__(self) -> None:
        self._scans: dict[str, ScanResult] = {}
        self._processes: dict[str, asyncio.subprocess.Process] = {}
        self._progress_callbacks: dict[str, list] = {}
        try:
            SCANS_DIR.mkdir(parents=True, exist_ok=True)
        except OSError:
            pass  # Will be created when needed (e.g., outside Docker)
        self._load_history()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def start_scan(self, request: ScanRequest) -> ScanResult:
        """Queue and start a new scan."""
        # Check for concurrent scans — only one allowed at a time
        running = [s for s in self._scans.values() if s.status == ScanStatus.RUNNING]
        if running:
            raise RuntimeError("A scan is already running. Please wait or cancel it first.")

        scan_id = uuid.uuid4().hex[:12]
        now = datetime.now(timezone.utc)

        scan = ScanResult(
            id=scan_id,
            scan_type=request.scan_type,
            status=ScanStatus.PENDING,
            directories=request.directories,
            excluded_directories=request.excluded_directories,
            options=request.options,
            created_at=now,
        )
        self._scans[scan_id] = scan
        self._persist(scan)

        # Launch in background
        asyncio.create_task(self._run_scan(scan))
        return scan

    def get_scan(self, scan_id: str) -> ScanResult | None:
        return self._scans.get(scan_id)

    def list_scans(self) -> list[ScanResult]:
        return sorted(self._scans.values(), key=lambda s: s.created_at, reverse=True)

    async def cancel_scan(self, scan_id: str) -> ScanResult | None:
        scan = self._scans.get(scan_id)
        if not scan:
            return None
        proc = self._processes.get(scan_id)
        if proc and proc.returncode is None:
            proc.terminate()
            try:
                await asyncio.wait_for(proc.wait(), timeout=5)
            except asyncio.TimeoutError:
                proc.kill()
        scan.status = ScanStatus.CANCELLED
        scan.completed_at = datetime.now(timezone.utc)
        self._persist(scan)
        return scan

    def register_progress_callback(self, scan_id: str, callback) -> None:
        self._progress_callbacks.setdefault(scan_id, []).append(callback)

    def unregister_progress_callback(self, scan_id: str, callback) -> None:
        cbs = self._progress_callbacks.get(scan_id, [])
        if callback in cbs:
            cbs.remove(callback)

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _build_command(self, scan: ScanResult, json_output_path: str | None = None) -> list[str]:
        """Build the czkawka_cli command line for v11+."""
        cmd = [CZKAWKA_BIN, scan.scan_type.value]

        # Directories — filter out non-existent paths to prevent czkawka errors
        # czkawka_cli flags expect comma-separated values
        valid_dirs = [d for d in (scan.directories or []) if Path(d).is_dir()]
        if valid_dirs:
            cmd.extend(["--directories", ",".join(valid_dirs)])
        elif scan.directories:
            # All directories are invalid
            cmd.extend(["--directories", ",".join(scan.directories)])  # let czkawka report the error

        # Excluded directories / items
        # czkawka_cli flags expect comma-separated values (not space-separated args)
        # --excluded-directories requires absolute paths
        # Relative patterns (like @eaDir, node_modules, .DS_Store) go to --excluded-items as wildcards
        if scan.excluded_directories:
            abs_dirs = [d for d in scan.excluded_directories if d.startswith("/")]
            patterns = [d for d in scan.excluded_directories if not d.startswith("/")]
            if abs_dirs:
                cmd.extend(["--excluded-directories", ",".join(abs_dirs)])
            if patterns:
                # Convert relative names to wildcard patterns: "node_modules" -> "*/node_modules"
                wildcards = [f"*/{p}" if not p.startswith("*") else p for p in patterns]
                cmd.extend(["--excluded-items", ",".join(wildcards)])

        # JSON output via file (v11 uses -C for compact JSON file)
        if json_output_path:
            cmd.extend(["--compact-file-to-save", json_output_path])

        # Suppress console output when saving to file
        cmd.append("--do-not-print-results")
        # Always return exit code 0 (don't use error code to signal "found results")
        cmd.append("--ignore-error-code-on-found")

        # Type-specific options
        opts = scan.options
        if scan.scan_type == ScanType.DUPLICATES:
            if opts.search_method:
                cmd.extend(["--search-method", opts.search_method.upper()])
            if opts.min_size is not None:
                cmd.extend(["--minimal-file-size", str(opts.min_size)])

        elif scan.scan_type == ScanType.SIMILAR_IMAGES:
            if opts.tolerance is not None:
                cmd.extend(["--max-difference", str(opts.tolerance)])

        elif scan.scan_type == ScanType.SIMILAR_VIDEOS:
            if opts.tolerance is not None:
                cmd.extend(["--tolerance", str(opts.tolerance)])

        elif scan.scan_type == ScanType.SIMILAR_MUSIC:
            if opts.music_similarity:
                cmd.extend(["--music-similarity", opts.music_similarity])

        elif scan.scan_type == ScanType.BROKEN:
            if opts.checked_types:
                cmd.extend(["--checked-types", ",".join(opts.checked_types)])

        # min_size applies globally if set for non-duplicate types too
        if opts.min_size is not None and scan.scan_type != ScanType.DUPLICATES:
            cmd.extend(["--minimal-file-size", str(opts.min_size)])

        return cmd

    async def _run_scan(self, scan: ScanResult) -> None:
        """Execute the scan subprocess."""
        scan.status = ScanStatus.RUNNING
        scan.started_at = datetime.now(timezone.utc)
        start_time = time.monotonic()

        # czkawka v11 writes JSON to a file, not stdout
        json_output = SCANS_DIR / f"{scan.id}_output.json"
        cmd = self._build_command(scan, str(json_output))

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            self._processes[scan.id] = proc

            # Read stderr for progress (czkawka prints progress to stderr)
            async def _read_progress():
                assert proc.stderr is not None
                async for line in proc.stderr:
                    text = line.decode(errors="replace").strip()
                    if text:
                        scan.progress.current_stage = text
                        scan.progress.elapsed_seconds = round(time.monotonic() - start_time, 1)

                        files_match = re.search(r'(\d+)\s*files?', text, re.IGNORECASE)
                        if files_match:
                            scan.progress.files_processed = int(files_match.group(1))

                        await self._notify_progress(scan.id, scan.progress)

            # Drain stdout too (to avoid blocking)
            async def _drain_stdout():
                assert proc.stdout is not None
                async for _ in proc.stdout:
                    pass

            progress_task = asyncio.create_task(_read_progress())
            stdout_task = asyncio.create_task(_drain_stdout())

            await proc.wait()
            await progress_task
            await stdout_task

            if scan.status == ScanStatus.CANCELLED:
                return

            # Check for results file first — if it exists, scan succeeded regardless of exit code
            results = None
            if json_output.exists():
                try:
                    results = json.loads(json_output.read_text())
                except json.JSONDecodeError:
                    results = None
                finally:
                    json_output.unlink(missing_ok=True)

            if results is not None or proc.returncode == 0:
                scan.results = self._normalize_results(results, scan.scan_type)
                scan.findings_count = self._count_findings(scan.results)
                scan.total_size = self._calc_total_size(scan.results)
                scan.status = ScanStatus.COMPLETED
            else:
                scan.status = ScanStatus.FAILED
                scan.error = f"czkawka_cli exited with code {proc.returncode}"

        except FileNotFoundError:
            scan.status = ScanStatus.FAILED
            scan.error = f"czkawka_cli binary not found at {CZKAWKA_BIN}"
        except Exception as exc:
            scan.status = ScanStatus.FAILED
            scan.error = str(exc)
        finally:
            scan.completed_at = datetime.now(timezone.utc)
            scan.progress.elapsed_seconds = round(time.monotonic() - start_time, 1)
            self._processes.pop(scan.id, None)
            json_output.unlink(missing_ok=True)  # cleanup
            self._persist(scan)

    async def _notify_progress(self, scan_id: str, progress: ScanProgress) -> None:
        for cb in self._progress_callbacks.get(scan_id, []):
            try:
                await cb(progress)
            except Exception:
                pass

    @staticmethod
    def _normalize_results(results, scan_type: ScanType):
        """Convert raw czkawka v11 JSON into a normalized format for the frontend.

        czkawka v11 grouped output (dup, image, video, music):
            { "size_bytes": [ [{"path":..,"size":..,"modified_date":..,"hash":..}, ...] ] }
        We normalize to:
            { "groups": [ {"id": 0, "files": [{"path":.., "size":.., "modified":.., "hash":..}], "total_size": N} ] }

        Flat scan types (empty-folders, empty-files, temp, etc.) may return a list.
        """
        if results is None:
            return {"groups": [], "files": []}

        # Already normalized (e.g., loaded from persisted scan)
        if isinstance(results, dict) and "groups" in results:
            return results
        if isinstance(results, dict) and "files" in results:
            return results

        grouped_types = {ScanType.DUPLICATES, ScanType.SIMILAR_IMAGES, ScanType.SIMILAR_VIDEOS, ScanType.SIMILAR_MUSIC}

        if scan_type in grouped_types and isinstance(results, dict):
            groups = []
            group_id = 0
            for _size_key, size_groups in results.items():
                if not isinstance(size_groups, list):
                    continue
                for group in size_groups:
                    if not isinstance(group, list) or not group:
                        continue
                    files = []
                    group_total = 0
                    for f in group:
                        if not isinstance(f, dict):
                            continue
                        size = int(f.get("size", 0))
                        mod_ts = f.get("modified_date", 0)
                        # Convert unix timestamp to ISO string
                        try:
                            modified = datetime.fromtimestamp(mod_ts, tz=timezone.utc).isoformat()
                        except (OSError, ValueError):
                            modified = ""
                        files.append({
                            "path": f.get("path", ""),
                            "size": size,
                            "modified": modified,
                            "hash": f.get("hash", ""),
                        })
                        group_total += size
                    if files:
                        groups.append({"id": group_id, "files": files, "total_size": group_total})
                        group_id += 1
            return {"groups": groups}

        # Flat results (list of paths or dicts)
        if isinstance(results, list):
            files = []
            for item in results:
                if isinstance(item, str):
                    files.append({"path": item, "size": 0, "modified": ""})
                elif isinstance(item, dict):
                    mod_ts = item.get("modified_date", 0)
                    try:
                        modified = datetime.fromtimestamp(mod_ts, tz=timezone.utc).isoformat()
                    except (OSError, ValueError):
                        modified = ""
                    files.append({
                        "path": item.get("path", ""),
                        "size": int(item.get("size", 0)),
                        "modified": modified,
                    })
            return {"files": files}

        return {"groups": [], "files": []}

    @staticmethod
    def _count_findings(results) -> int:
        """Count findings from normalized results."""
        if not results:
            return 0
        if isinstance(results, dict):
            if "groups" in results:
                return len(results["groups"])
            if "files" in results:
                return len(results["files"])
        return 0

    @staticmethod
    def _calc_total_size(results) -> int:
        """Calculate total file size from normalized results."""
        if not results:
            return 0
        total = 0
        if isinstance(results, dict):
            if "groups" in results:
                for group in results["groups"]:
                    total += group.get("total_size", 0)
            elif "files" in results:
                for f in results["files"]:
                    total += f.get("size", 0)
        return total

    def _persist(self, scan: ScanResult) -> None:
        """Save scan to disk."""
        path = SCANS_DIR / f"{scan.id}.json"
        path.write_text(scan.model_dump_json(indent=2))

    def _load_history(self) -> None:
        """Load completed/failed scans from disk on startup."""
        if not SCANS_DIR.exists():
            return
        for f in SCANS_DIR.glob("*.json"):
            try:
                data = json.loads(f.read_text())
                scan = ScanResult(**data)
                self._scans[scan.id] = scan
            except Exception:
                continue
