"""Tests for config management."""

from __future__ import annotations

import json
import os
import sys
import tempfile
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

# Override config dir
_test_cfg = tempfile.mkdtemp(prefix="config_test_")
os.environ["CONFIG_DIR"] = _test_cfg

import importlib
import config as config_module
importlib.reload(config_module)
from config import load_config, save_config  # noqa: E402
from models import AppConfig  # noqa: E402


@pytest.fixture(autouse=True)
def clean_config():
    """Remove settings.json before each test."""
    cfg_path = Path(_test_cfg) / "settings.json"
    if cfg_path.exists():
        cfg_path.unlink()
    # Also reload module to pick up fresh CONFIG_PATH
    config_module.CONFIG_PATH = cfg_path
    yield
    if cfg_path.exists():
        cfg_path.unlink()


class TestLoadConfig:
    def test_default_config_when_no_file(self):
        config = load_config()
        assert isinstance(config, AppConfig)
        assert config.default_directories == ["/storage"]
        assert "@eaDir" in config.default_excluded_directories
        assert config.trash_dir == "/config/trash"
        assert config.theme == "dark"

    def test_load_saved_config(self):
        cfg = AppConfig(
            default_directories=["/storage/media"],
            theme="light",
        )
        save_config(cfg)
        loaded = load_config()
        assert loaded.default_directories == ["/storage/media"]
        assert loaded.theme == "light"

    def test_corrupted_config_returns_default(self):
        cfg_path = Path(_test_cfg) / "settings.json"
        cfg_path.write_text("not valid json {{{")
        config = load_config()
        assert isinstance(config, AppConfig)
        assert config.default_directories == ["/storage"]


class TestSaveConfig:
    def test_save_creates_file(self):
        cfg_path = Path(_test_cfg) / "settings.json"
        assert not cfg_path.exists()
        save_config(AppConfig())
        assert cfg_path.exists()

    def test_save_valid_json(self):
        cfg_path = Path(_test_cfg) / "settings.json"
        save_config(AppConfig(theme="light"))
        data = json.loads(cfg_path.read_text())
        assert data["theme"] == "light"

    def test_save_creates_parent_dirs(self):
        nested = Path(_test_cfg) / "nested" / "deep"
        nested.mkdir(parents=True, exist_ok=True)
        config_module.CONFIG_PATH = nested / "settings.json"
        try:
            save_config(AppConfig())
            assert config_module.CONFIG_PATH.exists()
        finally:
            config_module.CONFIG_PATH = Path(_test_cfg) / "settings.json"

    def test_roundtrip_all_fields(self):
        cfg = AppConfig(
            default_directories=["/storage/a", "/storage/b"],
            default_excluded_directories=["@eaDir", ".DS_Store"],
            trash_dir="/config/custom_trash",
            thumbnail_cache_dir="/config/custom_thumbs",
            max_thumbnail_size=(200, 200),
            theme="light",
        )
        save_config(cfg)
        loaded = load_config()
        assert loaded.default_directories == cfg.default_directories
        assert loaded.default_excluded_directories == cfg.default_excluded_directories
        assert loaded.trash_dir == cfg.trash_dir
        assert loaded.thumbnail_cache_dir == cfg.thumbnail_cache_dir
        assert loaded.theme == cfg.theme
