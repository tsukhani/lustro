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

    def _build_command(self, scan: ScanResult) -> list[str]:
        """Build the czkawka_cli command line."""
        cmd = [CZKAWKA_BIN, scan.scan_type.value]

        # Directories
        if scan.directories:
            cmd.extend(["--directories", ",".join(scan.directories)])

        # Excluded directories
        if scan.excluded_directories:
            cmd.extend(["--excluded-directories", ",".join(scan.excluded_directories)])

        # JSON output (may not be available in all versions)
        cmd.append("--json")

        # Type-specific options
        opts = scan.options
        if scan.scan_type == ScanType.DUPLICATES:
            if opts.search_method:
                cmd.extend(["--search-method", opts.search_method])
            if opts.min_size is not None:
                cmd.extend(["--min-size", str(opts.min_size)])

        elif scan.scan_type == ScanType.SIMILAR_IMAGES:
            if opts.similarity_preset:
                cmd.extend(["--similarity-preset", opts.similarity_preset])

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
            cmd.extend(["--min-size", str(opts.min_size)])

        return cmd

    async def _run_scan(self, scan: ScanResult) -> None:
        """Execute the scan subprocess."""
        scan.status = ScanStatus.RUNNING
        scan.started_at = datetime.now(timezone.utc)
        start_time = time.monotonic()

        cmd = self._build_command(scan)

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            self._processes[scan.id] = proc

            # Read stderr for progress (line-by-line)
            stderr_lines: list[str] = []

            async def _read_progress():
                assert proc.stderr is not None
                async for line in proc.stderr:
                    text = line.decode(errors="replace").strip()
                    if text:
                        stderr_lines.append(text)
                        scan.progress.current_stage = text
                        scan.progress.elapsed_seconds = round(time.monotonic() - start_time, 1)

                        # Try to extract file count from progress messages
                        files_match = re.search(r'(\d+)\s*files?', text, re.IGNORECASE)
                        if files_match:
                            scan.progress.files_processed = int(files_match.group(1))

                        await self._notify_progress(scan.id, scan.progress)

            progress_task = asyncio.create_task(_read_progress())

            stdout_data, _ = await proc.communicate()
            await progress_task

            if scan.status == ScanStatus.CANCELLED:
                return

            if proc.returncode == 0:
                # Try JSON parsing first
                output_text = stdout_data.decode(errors="replace").strip() if stdout_data else ""
                results = None
                if output_text:
                    try:
                        results = json.loads(output_text)
                    except json.JSONDecodeError:
                        # Fallback to text parsing if JSON flag wasn't supported
                        results = parse_text_output(output_text, scan.scan_type)

                scan.results = results
                scan.findings_count = self._count_findings(results)
                scan.total_size = self._calc_total_size(results)
                scan.status = ScanStatus.COMPLETED
            else:
                # Check if --json flag caused the error (unsupported)
                stderr_text = "\n".join(stderr_lines)
                if "--json" in stderr_text or "unknown" in stderr_text.lower():
                    # Retry without --json
                    await self._run_scan_text_mode(scan, start_time)
                    return
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
            self._persist(scan)

    async def _run_scan_text_mode(self, scan: ScanResult, start_time: float) -> None:
        """Re-run scan without --json flag, parse text output instead."""
        cmd = [c for c in self._build_command(scan) if c != "--json"]

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            self._processes[scan.id] = proc

            stdout_data, stderr_data = await proc.communicate()

            if scan.status == ScanStatus.CANCELLED:
                return

            if proc.returncode == 0:
                output_text = stdout_data.decode(errors="replace").strip() if stdout_data else ""
                results = parse_text_output(output_text, scan.scan_type)
                scan.results = results
                scan.findings_count = self._count_findings(results)
                scan.total_size = self._calc_total_size(results)
                scan.status = ScanStatus.COMPLETED
            else:
                scan.status = ScanStatus.FAILED
                scan.error = f"czkawka_cli exited with code {proc.returncode}"
        except Exception as exc:
            scan.status = ScanStatus.FAILED
            scan.error = str(exc)
        finally:
            scan.completed_at = datetime.now(timezone.utc)
            scan.progress.elapsed_seconds = round(time.monotonic() - start_time, 1)
            self._processes.pop(scan.id, None)
            self._persist(scan)

    async def _notify_progress(self, scan_id: str, progress: ScanProgress) -> None:
        for cb in self._progress_callbacks.get(scan_id, []):
            try:
                await cb(progress)
            except Exception:
                pass

    @staticmethod
    def _count_findings(results) -> int:
        """Best-effort count of items in the results."""
        if not results:
            return 0
        if isinstance(results, list):
            # Could be groups or flat items
            count = 0
            for item in results:
                if isinstance(item, dict) and "files" in item:
                    count += len(item["files"])
                else:
                    count += 1
            return count
        if isinstance(results, dict):
            total = 0
            for v in results.values():
                if isinstance(v, list):
                    total += len(v)
            return total
        return 0

    @staticmethod
    def _calc_total_size(results) -> int:
        """Best-effort calculation of total file size from results."""
        if not results:
            return 0
        total = 0
        if isinstance(results, list):
            for item in results:
                if isinstance(item, dict):
                    if "files" in item:
                        for f in item["files"]:
                            if isinstance(f, dict) and "size" in f:
                                try:
                                    total += int(f["size"])
                                except (ValueError, TypeError):
                                    pass
                    elif "size" in item:
                        try:
                            total += int(item["size"])
                        except (ValueError, TypeError):
                            pass
        elif isinstance(results, dict):
            for v in results.values():
                if isinstance(v, list):
                    for item in v:
                        if isinstance(item, dict) and "size" in item:
                            try:
                                total += int(item["size"])
                            except (ValueError, TypeError):
                                pass
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
