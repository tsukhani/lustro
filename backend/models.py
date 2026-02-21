"""Pydantic models for scans, file operations, and configuration."""

from __future__ import annotations

import enum
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Scan types (map to czkawka_cli subcommands)
# ---------------------------------------------------------------------------

class ScanType(str, enum.Enum):
    DUPLICATES = "duplicates"
    SIMILAR_IMAGES = "similar-images"
    SIMILAR_VIDEOS = "similar-videos"
    SIMILAR_MUSIC = "similar-music"
    EMPTY_DIRS = "empty-dirs"
    EMPTY_FILES = "empty-files"
    TEMPORARY = "temporary"
    SYMLINKS = "symlinks"
    BAD_EXTENSIONS = "bad-extensions"
    BROKEN = "broken"


class ScanStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


# ---------------------------------------------------------------------------
# Scan request / response
# ---------------------------------------------------------------------------

class ScanOptions(BaseModel):
    """Type-specific scan options."""
    search_method: str | None = None          # duplicates: hash / size / name
    min_size: int | None = None               # minimum file size in bytes
    similarity_preset: str | None = None      # similar-images preset
    tolerance: int | None = None              # similar-videos tolerance
    music_similarity: str | None = None       # similar-music similarity
    checked_types: list[str] | None = None    # broken: file types to check


class ScanRequest(BaseModel):
    scan_type: ScanType
    directories: list[str] = Field(min_length=1)
    excluded_directories: list[str] = Field(default_factory=list)
    options: ScanOptions = Field(default_factory=ScanOptions)


class ScanProgress(BaseModel):
    current_stage: str = ""
    current_file: str = ""
    files_processed: int = 0
    elapsed_seconds: float = 0.0


class ScanResult(BaseModel):
    id: str
    scan_type: ScanType
    status: ScanStatus
    directories: list[str]
    excluded_directories: list[str]
    options: ScanOptions
    progress: ScanProgress = Field(default_factory=ScanProgress)
    results: Any | None = None   # parsed JSON from czkawka_cli
    findings_count: int = 0
    total_size: int = 0          # bytes of files found
    created_at: datetime
    started_at: datetime | None = None
    completed_at: datetime | None = None
    error: str | None = None


# ---------------------------------------------------------------------------
# File operations
# ---------------------------------------------------------------------------

class FileDeleteRequest(BaseModel):
    paths: list[str] = Field(min_length=1)


class FileTrashRequest(BaseModel):
    paths: list[str] = Field(min_length=1)


class FileOperationResult(BaseModel):
    success: list[str] = Field(default_factory=list)
    failed: list[dict[str, str]] = Field(default_factory=list)  # [{path, error}]


# ---------------------------------------------------------------------------
# Storage
# ---------------------------------------------------------------------------

class StorageStat(BaseModel):
    mount: str
    total: int          # bytes
    used: int           # bytes
    free: int           # bytes
    percent_used: float


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

class AppConfig(BaseModel):
    default_directories: list[str] = Field(default_factory=lambda: ["/storage"])
    default_excluded_directories: list[str] = Field(
        default_factory=lambda: [
            "@eaDir", ".Trash-*", "#recycle", ".DS_Store", "Thumbs.db", "node_modules"
        ]
    )
    trash_dir: str = "/config/trash"
    thumbnail_cache_dir: str = "/config/thumbnails"
    max_thumbnail_size: tuple[int, int] = (300, 300)
