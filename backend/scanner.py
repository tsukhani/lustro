"""czkawka_cli wrapper — scan management with async subprocess invocation."""

from __future__ import annotations

import asyncio
import json
import os
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

from models import ScanOptions, ScanProgress, ScanRequest, ScanResult, ScanStatus, ScanType

CZKAWKA_BIN = os.getenv("CZKAWKA_BIN", "/usr/local/bin/czkawka_cli")
SCANS_DIR = Path(os.getenv("CONFIG_DIR", "/config")) / "scans"


class ScanManager:
    """Manages czkawka_cli scan lifecycle."""

    def __init__(self) -> None:
        self._scans: dict[str, ScanResult] = {}
        self._processes: dict[str, asyncio.subprocess.Process] = {}
        self._progress_callbacks: dict[str, list] = {}
        SCANS_DIR.mkdir(parents=True, exist_ok=True)
        self._load_history()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def start_scan(self, request: ScanRequest) -> ScanResult:
        """Queue and start a new scan."""
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

        # JSON output
        cmd.append("--json")

        # Type-specific options
        opts = scan.options
        if opts.search_method and scan.scan_type == ScanType.DUPLICATES:
            cmd.extend(["--search-method", opts.search_method])
        if opts.min_size is not None:
            cmd.extend(["--min-size", str(opts.min_size)])
        if opts.similarity_preset and scan.scan_type == ScanType.SIMILAR_IMAGES:
            cmd.extend(["--similarity-preset", opts.similarity_preset])
        if opts.tolerance is not None and scan.scan_type == ScanType.SIMILAR_VIDEOS:
            cmd.extend(["--tolerance", str(opts.tolerance)])
        if opts.music_similarity and scan.scan_type == ScanType.SIMILAR_MUSIC:
            cmd.extend(["--music-similarity", opts.music_similarity])

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
            async def _read_progress():
                assert proc.stderr is not None
                async for line in proc.stderr:
                    text = line.decode(errors="replace").strip()
                    if text:
                        scan.progress.current_stage = text
                        scan.progress.elapsed_seconds = round(time.monotonic() - start_time, 1)
                        await self._notify_progress(scan.id, scan.progress)

            progress_task = asyncio.create_task(_read_progress())

            stdout, _ = await proc.communicate()
            await progress_task

            if scan.status == ScanStatus.CANCELLED:
                return

            if proc.returncode == 0:
                # Parse JSON results
                try:
                    results = json.loads(stdout.decode()) if stdout.strip() else None
                    scan.results = results
                    scan.findings_count = self._count_findings(results)
                except json.JSONDecodeError:
                    scan.results = None

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
            self._persist(scan)

    async def _notify_progress(self, scan_id: str, progress: ScanProgress) -> None:
        for cb in self._progress_callbacks.get(scan_id, []):
            try:
                await cb(progress)
            except Exception:
                pass

    @staticmethod
    def _count_findings(results) -> int:
        """Best-effort count of items in the results JSON."""
        if not results:
            return 0
        if isinstance(results, list):
            return len(results)
        if isinstance(results, dict):
            total = 0
            for v in results.values():
                if isinstance(v, list):
                    total += len(v)
            return total
        return 0

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
