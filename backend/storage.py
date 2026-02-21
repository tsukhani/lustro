"""Disk usage stats for mounted storage volumes."""

from __future__ import annotations

import os
import shutil
from pathlib import Path

from models import StorageStat

STORAGE_ROOT = Path(os.getenv("STORAGE_ROOT", "/storage"))


async def get_storage_stats() -> list[StorageStat]:
    """Return disk usage for unique filesystems under /storage.
    
    All Docker bind mounts from the same NAS volume will show the same
    filesystem stats. We deduplicate by (total, free) to avoid double-counting.
    We report one entry per unique filesystem, labeled with all mount points.
    """
    stats: list[StorageStat] = []

    if not STORAGE_ROOT.exists():
        return stats

    # Collect unique filesystems by (total, free) fingerprint
    seen_fs: dict[tuple[int, int], list[str]] = {}

    children = sorted([c for c in STORAGE_ROOT.iterdir() if c.is_dir()])

    for child in children:
        try:
            usage = shutil.disk_usage(child)
            fs_key = (usage.total, usage.free)
            if fs_key not in seen_fs:
                seen_fs[fs_key] = []
            seen_fs[fs_key].append(str(child))
        except OSError:
            continue

    # Create one stat per unique filesystem
    for (total, free), mounts in seen_fs.items():
        used = total - free
        # Label: if single mount, use its name. If multiple on same fs, show "Shared Volume"
        if len(mounts) == 1:
            label = mounts[0]
        else:
            label = f"/storage ({len(mounts)} folders)"

        stats.append(
            StorageStat(
                mount=label,
                total=total,
                used=used,
                free=free,
                percent_used=round(used / total * 100, 1) if total else 0.0,
                sub_mounts=mounts if len(mounts) > 1 else None,
            )
        )

    return stats
