"""Disk usage stats for mounted storage volumes."""

from __future__ import annotations

import os
import shutil
from pathlib import Path

from models import StorageStat

STORAGE_ROOT = Path(os.getenv("STORAGE_ROOT", "/storage"))


def get_storage_stats() -> list[StorageStat]:
    """Return disk usage for each direct child of the storage root."""
    stats: list[StorageStat] = []

    if not STORAGE_ROOT.exists():
        return stats

    # Check the root mount itself
    try:
        usage = shutil.disk_usage(STORAGE_ROOT)
        stats.append(
            StorageStat(
                mount=str(STORAGE_ROOT),
                total=usage.total,
                used=usage.used,
                free=usage.free,
                percent_used=round(usage.used / usage.total * 100, 1) if usage.total else 0.0,
            )
        )
    except OSError:
        pass

    # Also check first-level sub-directories (they might be separate mounts)
    seen_devices: set[int] = set()
    try:
        root_stat = os.stat(STORAGE_ROOT)
        seen_devices.add(root_stat.st_dev)
    except OSError:
        pass

    for child in sorted(STORAGE_ROOT.iterdir()):
        if not child.is_dir():
            continue
        try:
            child_stat = os.stat(child)
            if child_stat.st_dev in seen_devices:
                continue  # same filesystem as root
            seen_devices.add(child_stat.st_dev)
            usage = shutil.disk_usage(child)
            stats.append(
                StorageStat(
                    mount=str(child),
                    total=usage.total,
                    used=usage.used,
                    free=usage.free,
                    percent_used=round(usage.used / usage.total * 100, 1) if usage.total else 0.0,
                )
            )
        except OSError:
            continue

    return stats
