"""Tests for API endpoints using httpx TestClient."""

from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient

# Ensure backend is on path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Set env vars before importing app modules
_cfg = tempfile.mkdtemp(prefix="api_test_cfg_")
_stor = tempfile.mkdtemp(prefix="api_test_stor_")
os.environ["CONFIG_DIR"] = _cfg
os.environ["STORAGE_ROOT"] = _stor

import file_ops  # noqa: E402
from main import app  # noqa: E402


@pytest.fixture(autouse=True)
def _patch_storage(tmp_path):
    """Ensure STORAGE_ROOT points at a fresh tmp dir for each test."""
    original = file_ops.STORAGE_ROOT
    file_ops.STORAGE_ROOT = tmp_path
    yield
    file_ops.STORAGE_ROOT = original


@pytest.fixture
def storage_with_file(tmp_path):
    """tmp_path directory with a test file (same as STORAGE_ROOT)."""
    (tmp_path / "test.txt").write_text("hello")
    return tmp_path


@pytest.mark.asyncio
async def test_health():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"


@pytest.mark.asyncio
async def test_get_config():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/config")
    assert resp.status_code == 200
    data = resp.json()
    assert "default_directories" in data
    assert "trash_dir" in data
    assert "theme" in data


@pytest.mark.asyncio
async def test_update_config():
    new_config = {
        "default_directories": ["/storage/media"],
        "default_excluded_directories": ["@eaDir"],
        "trash_dir": "/config/trash",
        "thumbnail_cache_dir": "/config/thumbnails",
        "max_thumbnail_size": [200, 200],
        "theme": "light",
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.put("/api/config", json=new_config)
    assert resp.status_code == 200
    data = resp.json()
    assert data["theme"] == "light"
    assert data["default_directories"] == ["/storage/media"]


@pytest.mark.asyncio
async def test_storage_stats():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/storage/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_list_scans():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/scans")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_get_scan_not_found():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/scans/nonexistent123")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_cancel_scan_not_found():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.delete("/api/scans/nonexistent123")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_files_outside_storage(tmp_path):
    """Attempting to delete files outside storage root should fail."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/files/delete", json={"paths": ["/etc/passwd"]})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["failed"]) > 0
    assert len(data["success"]) == 0


@pytest.mark.asyncio
async def test_delete_files_success(tmp_path):
    """Delete a real file in storage."""
    test_file = tmp_path / "to_delete.txt"
    test_file.write_text("delete me")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/files/delete", json={"paths": [str(test_file)]})
    assert resp.status_code == 200
    data = resp.json()
    assert str(test_file) in data["success"]
    assert not test_file.exists()


@pytest.mark.asyncio
async def test_trash_and_list_and_restore(tmp_path):
    """Trash a file, list trash, then restore it."""
    test_file = tmp_path / "trash_me.txt"
    test_file.write_text("trash this content")
    trash_dir = tmp_path / "_trash"

    # Patch config to use local dirs
    from models import AppConfig
    test_config = AppConfig(
        trash_dir=str(trash_dir),
        thumbnail_cache_dir=str(tmp_path / "_thumbs"),
    )

    with patch("main.load_config", return_value=test_config):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Trash
            resp = await client.post("/api/files/trash", json={"paths": [str(test_file)]})
            assert resp.status_code == 200
            data = resp.json()
            assert str(test_file) in data["success"]
            assert not test_file.exists()

            # List trash
            resp = await client.get("/api/files/trash")
            assert resp.status_code == 200
            trash_items = resp.json()
            assert isinstance(trash_items, list)
            assert len(trash_items) >= 1
            trash_id = trash_items[0]["trash_id"]

            # Restore
            resp = await client.post("/api/files/restore", json={"trash_id": trash_id})
            assert resp.status_code == 200
            data = resp.json()
            assert len(data["success"]) == 1


@pytest.mark.asyncio
async def test_preview_nonexistent():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/files/preview/nonexistent/file.jpg")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_scan_request_validation():
    """Missing directories should fail validation."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/scans", json={
            "scan_type": "duplicates",
            "directories": [],
        })
    assert resp.status_code == 422  # Validation error


@pytest.mark.asyncio
async def test_get_trash_empty():
    """Trash listing works when empty."""
    from models import AppConfig
    test_config = AppConfig(trash_dir=tempfile.mkdtemp())
    with patch("main.load_config", return_value=test_config):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/api/files/trash")
    assert resp.status_code == 200
    assert resp.json() == []
