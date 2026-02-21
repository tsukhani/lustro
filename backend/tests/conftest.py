"""Shared test fixtures."""

from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

import pytest

# Ensure backend is importable
sys.path.insert(0, str(Path(__file__).parent.parent))

# Override environment variables BEFORE importing any backend modules
_temp_config = tempfile.mkdtemp(prefix="czkawka_test_config_")
_temp_storage = tempfile.mkdtemp(prefix="czkawka_test_storage_")

os.environ["CONFIG_DIR"] = _temp_config
os.environ["STORAGE_ROOT"] = _temp_storage
os.environ["CZKAWKA_BIN"] = "/usr/local/bin/czkawka_cli"


@pytest.fixture
def temp_config_dir():
    """Return a fresh temp directory for config."""
    d = tempfile.mkdtemp(prefix="czkawka_cfg_")
    yield Path(d)
    import shutil
    shutil.rmtree(d, ignore_errors=True)


@pytest.fixture
def temp_storage_dir():
    """Return a fresh temp directory for storage with test files."""
    d = tempfile.mkdtemp(prefix="czkawka_stor_")
    storage = Path(d)

    # Create some test files
    (storage / "test_file.txt").write_text("hello world")
    (storage / "test_image.txt").write_text("fake image")
    sub = storage / "subdir"
    sub.mkdir()
    (sub / "nested.txt").write_text("nested content")

    yield storage
    import shutil
    shutil.rmtree(d, ignore_errors=True)


@pytest.fixture
def app_config(temp_config_dir):
    """Return an AppConfig pointing at temp dirs."""
    from models import AppConfig
    return AppConfig(
        trash_dir=str(temp_config_dir / "trash"),
        thumbnail_cache_dir=str(temp_config_dir / "thumbnails"),
    )
