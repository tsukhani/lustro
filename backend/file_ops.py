"""File operations — delete, trash, preview."""

from __future__ import annotations

import os
import shutil
import time
from io import BytesIO
from pathlib import Path

from PIL import Image

from models import AppConfig, FileOperationResult

STORAGE_ROOT = Path(os.getenv("STORAGE_ROOT", "/storage"))


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

            # Unique trash name to avoid collisions
            ts = int(time.time() * 1000)
            dest = trash_dir / f"{ts}_{resolved.name}"
            shutil.move(str(resolved), str(dest))

            # Save metadata for potential restore
            meta_path = dest.with_suffix(dest.suffix + ".meta")
            meta_path.write_text(f"{resolved}\n")

            result.success.append(p)
        except Exception as exc:
            result.failed.append({"path": p, "error": str(exc)})
    return result


def generate_thumbnail(path: str, max_size: tuple[int, int] = (300, 300)) -> bytes | None:
    """Generate a JPEG thumbnail for an image file."""
    try:
        resolved = _validate_path(path)
        with Image.open(resolved) as img:
            img.thumbnail(max_size)
            buf = BytesIO()
            img.save(buf, format="JPEG", quality=80)
            return buf.getvalue()
    except Exception:
        return None
