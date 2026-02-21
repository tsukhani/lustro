"""Tests for file operations — delete, trash, preview, restore."""

from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from models import AppConfig  # noqa: E402
import file_ops  # noqa: E402
from file_ops import delete_files, generate_thumbnail, get_trash, restore_from_trash, trash_files  # noqa: E402


@pytest.fixture(autouse=True)
def _patch_storage_root(tmp_path):
    """Monkey-patch STORAGE_ROOT for every test so _validate_path works."""
    original = file_ops.STORAGE_ROOT
    file_ops.STORAGE_ROOT = tmp_path
    yield
    file_ops.STORAGE_ROOT = original


@pytest.fixture
def storage(tmp_path):
    """Fresh storage directory with test files (same as patched STORAGE_ROOT)."""
    p = tmp_path
    (p / "file1.txt").write_text("content 1")
    (p / "file2.txt").write_text("content 2")
    sub = p / "subdir"
    sub.mkdir(exist_ok=True)
    (sub / "nested.txt").write_text("nested")
    return p


@pytest.fixture
def config(tmp_path_factory):
    d = tmp_path_factory.mktemp("cfg")
    return AppConfig(
        trash_dir=str(d / "trash"),
        thumbnail_cache_dir=str(d / "thumbs"),
    )


class TestDeleteFiles:
    def test_delete_single_file(self, storage):
        f = storage / "file1.txt"
        assert f.exists()
        result = delete_files([str(f)])
        assert str(f) in result.success
        assert not f.exists()

    def test_delete_directory(self, storage):
        d = storage / "subdir"
        assert d.exists()
        result = delete_files([str(d)])
        assert str(d) in result.success
        assert not d.exists()

    def test_delete_nonexistent(self, storage):
        result = delete_files([str(storage / "noexist.txt")])
        assert len(result.failed) == 1
        assert result.failed[0]["error"] == "Not found"

    def test_delete_outside_storage(self):
        """Paths outside storage root should fail with security error."""
        result = delete_files(["/etc/passwd"])
        assert len(result.failed) == 1
        assert "outside storage root" in result.failed[0]["error"]

    def test_delete_multiple(self, storage):
        f1 = storage / "file1.txt"
        f2 = storage / "file2.txt"
        result = delete_files([str(f1), str(f2)])
        assert len(result.success) == 2
        assert not f1.exists()
        assert not f2.exists()


class TestTrashFiles:
    def test_trash_single_file(self, storage, config):
        f = storage / "file1.txt"
        result = trash_files([str(f)], config)
        assert str(f) in result.success
        assert not f.exists()
        # File should be in trash dir
        trash_dir = Path(config.trash_dir)
        assert trash_dir.exists()
        trashed_files = [p for p in trash_dir.iterdir() if not p.name.endswith(".meta.json")]
        assert len(trashed_files) >= 1

    def test_trash_nonexistent(self, storage, config):
        result = trash_files([str(storage / "nope.txt")], config)
        assert len(result.failed) == 1

    def test_trash_outside_storage(self, config):
        result = trash_files(["/etc/hosts"], config)
        assert len(result.failed) == 1

    def test_trash_creates_metadata(self, storage, config):
        f = storage / "file2.txt"
        trash_files([str(f)], config)
        trash_dir = Path(config.trash_dir)
        meta_files = list(trash_dir.glob("*.meta.json"))
        assert len(meta_files) >= 1
        import json
        meta = json.loads(meta_files[0].read_text())
        assert "original_path" in meta
        assert "trashed_at" in meta
        assert "filename" in meta


class TestGetTrash:
    def test_empty_trash(self, config):
        items = get_trash(config)
        assert items == []

    def test_trash_then_list(self, storage, config):
        f = storage / "file1.txt"
        trash_files([str(f)], config)
        items = get_trash(config)
        assert len(items) == 1
        assert items[0].filename == "file1.txt"
        assert "file1.txt" in items[0].original_path

    def test_multiple_trash_items(self, storage, config):
        import time
        f1 = storage / "file1.txt"
        trash_files([str(f1)], config)
        time.sleep(0.01)  # Ensure different timestamps
        f2 = storage / "file2.txt"
        trash_files([str(f2)], config)
        items = get_trash(config)
        assert len(items) == 2


class TestRestoreFromTrash:
    def test_restore_file(self, storage, config):
        f = storage / "file1.txt"
        original_content = f.read_text()
        trash_files([str(f)], config)
        assert not f.exists()

        items = get_trash(config)
        trash_id = items[0].trash_id

        result = restore_from_trash(trash_id, config)
        assert len(result.success) == 1
        # File should be restored (possibly with suffix if collision)
        restored_path = Path(result.success[0])
        assert restored_path.exists()
        assert restored_path.read_text() == original_content

    def test_restore_nonexistent(self, config):
        result = restore_from_trash("nonexistent_id", config)
        assert len(result.failed) == 1

    def test_restore_clears_metadata(self, storage, config):
        f = storage / "file1.txt"
        trash_files([str(f)], config)
        items = get_trash(config)
        trash_id = items[0].trash_id

        restore_from_trash(trash_id, config)

        # Metadata should be cleaned up
        trash_dir = Path(config.trash_dir)
        meta_files = list(trash_dir.glob("*.meta.json"))
        assert len(meta_files) == 0


class TestGenerateThumbnail:
    def test_non_image_returns_none(self, storage):
        f = storage / "file1.txt"
        result = generate_thumbnail(str(f))
        assert result is None

    def test_nonexistent_returns_none(self, storage):
        result = generate_thumbnail(str(storage / "noexist.jpg"))
        assert result is None

    def test_outside_storage_returns_none(self):
        result = generate_thumbnail("/etc/passwd")
        assert result is None

    def test_real_image(self, storage):
        """Create a real PNG and generate thumbnail."""
        from PIL import Image

        img_path = storage / "test.png"
        img = Image.new("RGB", (800, 600), color="red")
        img.save(str(img_path))

        result = generate_thumbnail(str(img_path))
        assert result is not None
        assert len(result) > 0
        # Verify it's valid JPEG
        from io import BytesIO
        thumb = Image.open(BytesIO(result))
        assert thumb.format == "JPEG"
        assert thumb.size[0] <= 300
        assert thumb.size[1] <= 300

    def test_thumbnail_caching(self, storage, config):
        """Thumbnails should be cached on second call."""
        from PIL import Image

        img_path = storage / "cached.png"
        img = Image.new("RGB", (400, 400), color="blue")
        img.save(str(img_path))

        cache_dir = Path(config.thumbnail_cache_dir)

        # First call generates
        result1 = generate_thumbnail(str(img_path), cache_dir=cache_dir)
        assert result1 is not None
        cached = list(cache_dir.glob("*.jpg"))
        assert len(cached) == 1

        # Second call uses cache
        result2 = generate_thumbnail(str(img_path), cache_dir=cache_dir)
        assert result2 == result1

    def test_rgba_image(self, storage):
        """RGBA images should be converted to RGB for JPEG."""
        from PIL import Image

        img_path = storage / "rgba.png"
        img = Image.new("RGBA", (100, 100), color=(255, 0, 0, 128))
        img.save(str(img_path))

        result = generate_thumbnail(str(img_path))
        assert result is not None
