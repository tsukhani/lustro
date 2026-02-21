"""Disk usage stats for mounted storage volumes."""

from __future__ import annotations

import asyncio
import os
import shutil
from pathlib import Path

from models import StorageStat

STORAGE_ROOT = Path(os.getenv("STORAGE_ROOT", "/storage"))


async def _get_folder_size(path: Path) -> int:
    """Get actual folder size using du -sb (fast, handles large dirs)."""
    try:
        proc = await asyncio.create_subprocess_exec(
            "du", "-sb", str(path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=30)
        if stdout:
            size_str = stdout.decode().split()[0]
            return int(size_str)
    except (asyncio.TimeoutError, ValueError, IndexError):
        pass
    return 0


async def get_storage_stats() -> list[StorageStat]:
    """Return disk usage for the storage filesystem + per-folder sizes."""
    stats: list[StorageStat] = []

    if not STORAGE_ROOT.exists():
        return stats

    # Get the overall filesystem stats (from the root mount)
    try:
        usage = shutil.disk_usage(STORAGE_ROOT)
        fs_total = usage.total
        fs_used = usage.used
        fs_free = usage.free
    except OSError:
        return stats

    # Collect sub-directories
    children = sorted([c for c in STORAGE_ROOT.iterdir() if c.is_dir()])

    # Get actual folder sizes in parallel
    tasks = [_get_folder_size(child) for child in children]
    sizes = await asyncio.gather(*tasks)

    # Add per-folder stats (actual folder size, filesystem total for context)
    for child, folder_size in zip(children, sizes):
        stats.append(
            StorageStat(
                mount=str(child),
                total=fs_total,
                used=folder_size,
                free=fs_free,
                percent_used=round(folder_size / fs_total * 100, 1) if fs_total else 0.0,
            )
        )

    return stats
