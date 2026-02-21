"""Tests for storage stats."""

from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

# Override storage root
_test_storage = tempfile.mkdtemp(prefix="storage_test_")
os.environ["STORAGE_ROOT"] = _test_storage

# Must reimport to pick up the env var
import importlib
import storage as storage_module
importlib.reload(storage_module)
from storage import get_storage_stats  # noqa: E402


@pytest.fixture
def storage_root():
    p = Path(_test_storage)
    # Create subdirectories
    (p / "video").mkdir(exist_ok=True)
    (p / "music").mkdir(exist_ok=True)
    (p / "docs").mkdir(exist_ok=True)
    return p


class TestStorageStats:
    def test_returns_list(self, storage_root):
        stats = get_storage_stats()
        assert isinstance(stats, list)

    def test_has_root_mount(self, storage_root):
        stats = get_storage_stats()
        # Should at least have the root storage mount
        assert len(stats) >= 1
        root_stat = stats[0]
        assert root_stat.mount == str(storage_root)
        assert root_stat.total > 0
        assert root_stat.used >= 0
        assert root_stat.free >= 0
        assert 0 <= root_stat.percent_used <= 100

    def test_stats_are_storage_stat_models(self, storage_root):
        from models import StorageStat
        stats = get_storage_stats()
        for stat in stats:
            assert isinstance(stat, StorageStat)
            assert isinstance(stat.mount, str)
            assert isinstance(stat.total, int)
            assert isinstance(stat.used, int)
            assert isinstance(stat.free, int)
            assert isinstance(stat.percent_used, float)

    def test_nonexistent_storage_root(self):
        """If storage root doesn't exist, return empty list."""
        # Temporarily change the module-level variable
        original = storage_module.STORAGE_ROOT
        storage_module.STORAGE_ROOT = Path("/nonexistent/path/12345")
        try:
            stats = get_storage_stats()
            assert stats == []
        finally:
            storage_module.STORAGE_ROOT = original
