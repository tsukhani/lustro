"""Config management — load/save from /config/settings.json."""

from __future__ import annotations

import json
import os
from pathlib import Path

from models import AppConfig

CONFIG_PATH = Path(os.getenv("CONFIG_DIR", "/config")) / "settings.json"


def load_config() -> AppConfig:
    """Load config from disk, returning defaults if file doesn't exist."""
    if CONFIG_PATH.exists():
        try:
            data = json.loads(CONFIG_PATH.read_text())
            return AppConfig(**data)
        except Exception:
            pass
    return AppConfig()


def save_config(config: AppConfig) -> None:
    """Persist config to disk."""
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(config.model_dump_json(indent=2))
