"""File operations — delete, trash, preview, restore."""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import time
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path

from PIL import Image

from models import AppConfig, FileOperationResult, TrashItem

STORAGE_ROOT = Path(os.getenv("STORAGE_ROOT", "/storage"))
THUMBNAIL_CACHE_DIR = Path(os.getenv("CONFIG_DIR", "/config")) / "thumbnails"


def _validate_path(path: str) -> Path:
    """Ensure path is under /storage to prevent directory traversal."""
    resolved = Path(path).resolve()
    if not str(resolved).startswith(str(STORAGE_ROOT.resolve())):
        raise ValueError(f"Path {path} is outside storage root")
    return resolved


def delete_files(paths: list[str]) -> FileOperationResult:
    """Permanently delete files."""
    result = FileOperationResult()
    for p in paths:
        try:
            resolved = _validate_path(p)
            if resolved.is_file():
                resolved.unlink()
                result.success.append(p)
            elif resolved.is_dir():
                shutil.rmtree(resolved)
                result.success.append(p)
            else:
                result.failed.append({"path": p, "error": "Not found"})
        except Exception as exc:
            result.failed.append({"path": p, "error": str(exc)})
    return result


def trash_files(paths: list[str], config: AppConfig) -> FileOperationResult:
    """Move files to trash directory (preserving restore metadata)."""
    trash_dir = Path(config.trash_dir)
    trash_dir.mkdir(parents=True, exist_ok=True)

    result = FileOperationResult()
    for p in paths:
        try:
            resolved = _validate_path(p)
            if not resolved.exists():
                result.failed.append({"path": p, "error": "Not found"})
                continue

            # Create unique trash ID
            ts = int(time.time() * 1000)
            trash_id = f"{ts}_{resolved.name}"
            dest = trash_dir / trash_id
            shutil.move(str(resolved), str(dest))

            # Save metadata JSON for restore
            meta = {
                "trash_id": trash_id,
                "original_path": str(resolved),
                "trashed_at": datetime.now(timezone.utc).isoformat(),
                "filename": resolved.name,
                "size": dest.stat().st_size if dest.is_file() else 0,
            }
            meta_path = trash_dir / f"{trash_id}.meta.json"
            meta_path.write_text(json.dumps(meta, indent=2))

            result.success.append(p)
        except Exception as exc:
            result.failed.append({"path": p, "error": str(exc)})
    return result


def get_trash(config: AppConfig) -> list[TrashItem]:
    """List all files in the trash directory."""
    trash_dir = Path(config.trash_dir)
    if not trash_dir.exists():
        return []

    items: list[TrashItem] = []
    for meta_file in sorted(trash_dir.glob("*.meta.json"), reverse=True):
        try:
            meta = json.loads(meta_file.read_text())
            trash_id = meta["trash_id"]
            trash_file = trash_dir / trash_id

            items.append(TrashItem(
                trash_id=trash_id,
                original_path=meta.get("original_path", "unknown"),
                trashed_at=datetime.fromisoformat(meta["trashed_at"]),
                filename=meta.get("filename", trash_id),
                size=meta.get("size", trash_file.stat().st_size if trash_file.exists() else 0),
            ))
        except Exception:
            continue

    return items


def restore_from_trash(trash_id: str, config: AppConfig) -> FileOperationResult:
    """Restore a file from trash to its original location."""
    trash_dir = Path(config.trash_dir)
    result = FileOperationResult()

    trash_file = trash_dir / trash_id
    meta_file = trash_dir / f"{trash_id}.meta.json"

    if not trash_file.exists():
        result.failed.append({"path": trash_id, "error": "Trashed file not found"})
        return result

    if not meta_file.exists():
        result.failed.append({"path": trash_id, "error": "Trash metadata not found"})
        return result

    try:
        meta = json.loads(meta_file.read_text())
        original_path = Path(meta["original_path"])

        # Ensure parent directory exists
        original_path.parent.mkdir(parents=True, exist_ok=True)

        # If original path already exists, add suffix
        dest = original_path
        if dest.exists():
            stem = dest.stem
            suffix = dest.suffix
            counter = 1
            while dest.exists():
                dest = dest.parent / f"{stem}_restored_{counter}{suffix}"
                counter += 1

        shutil.move(str(trash_file), str(dest))
        meta_file.unlink()

        result.success.append(str(dest))
    except Exception as exc:
        result.failed.append({"path": trash_id, "error": str(exc)})

    return result


def generate_thumbnail(
    path: str,
    max_size: tuple[int, int] = (300, 300),
    cache_dir: Path | None = None,
) -> bytes | None:
    """Generate a JPEG thumbnail for an image file, with disk caching."""
    try:
        resolved = _validate_path(path)
    except (ValueError, Exception):
        return None

    if not resolved.is_file():
        return None

    # Check cache
    if cache_dir is None:
        cache_dir = THUMBNAIL_CACHE_DIR

    cache_dir.mkdir(parents=True, exist_ok=True)

    # Cache key based on path + mtime
    stat = resolved.stat()
    cache_key = hashlib.md5(f"{resolved}:{stat.st_mtime}:{stat.st_size}".encode()).hexdigest()
    cache_path = cache_dir / f"{cache_key}.jpg"

    if cache_path.exists():
        return cache_path.read_bytes()

    # Generate thumbnail
    try:
        with Image.open(resolved) as img:
            img.thumbnail(max_size)
            buf = BytesIO()
            # Convert to RGB if needed (e.g. RGBA PNGs)
            if img.mode not in ("RGB", "L"):
                img = img.convert("RGB")
            img.save(buf, format="JPEG", quality=80)
            data = buf.getvalue()

            # Write to cache
            try:
                cache_path.write_bytes(data)
            except OSError:
                pass  # Cache write failure is not critical

            return data
    except Exception:
        return None
