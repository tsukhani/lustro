"""FastAPI application — Czkawka Web UI backend."""

from __future__ import annotations

import asyncio
from pathlib import Path

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles

from config import load_config, save_config
from file_ops import delete_files, generate_thumbnail, get_trash, restore_from_trash, trash_files
from models import (
    AppConfig,
    FileDeleteRequest,
    FileTrashRequest,
    ScanRequest,
    TrashRestoreRequest,
)
from scanner import ScanManager
from storage import get_storage_stats

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(title="Czkawka Web UI", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

scan_manager = ScanManager()

# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Scan endpoints
# ---------------------------------------------------------------------------


@app.post("/api/scans")
async def create_scan(request: ScanRequest):
    try:
        scan = await scan_manager.start_scan(request)
        return scan
    except RuntimeError as e:
        raise HTTPException(status_code=409, detail=str(e))


@app.get("/api/scans")
async def list_scans():
    return scan_manager.list_scans()


@app.get("/api/scans/{scan_id}")
async def get_scan(scan_id: str):
    scan = scan_manager.get_scan(scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    return scan


@app.delete("/api/scans/{scan_id}")
async def cancel_scan(scan_id: str):
    scan = await scan_manager.cancel_scan(scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    return scan


@app.websocket("/api/scans/{scan_id}/ws")
async def scan_progress_ws(websocket: WebSocket, scan_id: str):
    await websocket.accept()

    scan = scan_manager.get_scan(scan_id)
    if not scan:
        await websocket.close(code=4004, reason="Scan not found")
        return

    queue: asyncio.Queue = asyncio.Queue()

    async def on_progress(progress):
        await queue.put(progress.model_dump())

    scan_manager.register_progress_callback(scan_id, on_progress)
    try:
        while True:
            # Send progress updates or heartbeat
            try:
                data = await asyncio.wait_for(queue.get(), timeout=5.0)
                await websocket.send_json(data)
            except asyncio.TimeoutError:
                # Heartbeat ping
                await websocket.send_json({"type": "ping"})

            # Check if scan is done
            current = scan_manager.get_scan(scan_id)
            if current and current.status.value in ("completed", "failed", "cancelled"):
                await websocket.send_json({"type": "done", "status": current.status.value})
                break
    except WebSocketDisconnect:
        pass
    finally:
        scan_manager.unregister_progress_callback(scan_id, on_progress)


# ---------------------------------------------------------------------------
# File operations
# ---------------------------------------------------------------------------


@app.post("/api/files/delete")
async def api_delete_files(request: FileDeleteRequest):
    return delete_files(request.paths)


@app.post("/api/files/trash")
async def api_trash_files(request: FileTrashRequest):
    config = load_config()
    return trash_files(request.paths, config)


@app.get("/api/files/trash")
async def api_get_trash():
    config = load_config()
    return get_trash(config)


@app.post("/api/files/restore")
async def api_restore_from_trash(request: TrashRestoreRequest):
    config = load_config()
    return restore_from_trash(request.trash_id, config)


@app.get("/api/files/preview/{path:path}")
async def file_preview(path: str):
    full_path = f"/{path}"  # reconstruct absolute path
    config = load_config()
    cache_dir = Path(config.thumbnail_cache_dir)
    data = generate_thumbnail(full_path, config.max_thumbnail_size, cache_dir)
    if data is None:
        raise HTTPException(status_code=404, detail="Cannot generate preview")
    return Response(content=data, media_type="image/jpeg")


# ---------------------------------------------------------------------------
# Storage
# ---------------------------------------------------------------------------


@app.get("/api/storage/stats")
async def storage_stats():
    return await get_storage_stats()


@app.get("/api/storage/directories")
async def storage_directories():
    """List actual directories available under /storage."""
    import shutil
    from pathlib import Path
    storage_root = Path(os.getenv("STORAGE_ROOT", "/storage"))
    dirs = []
    if storage_root.exists():
        for child in sorted(storage_root.iterdir()):
            if child.is_dir():
                name = child.name.replace("_", " ").replace("-", " ").title()
                try:
                    usage = shutil.disk_usage(child)
                    # Get actual folder size estimate from the directory
                    # Use a quick count of immediate children as a proxy
                    dirs.append({
                        "path": str(child),
                        "name": name,
                    })
                except OSError:
                    dirs.append({"path": str(child), "name": name})
    return dirs


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------


@app.get("/api/config")
async def get_config():
    return load_config()


@app.put("/api/config")
async def update_config(config: AppConfig):
    save_config(config)
    return config


# ---------------------------------------------------------------------------
# Static file serving (SPA)
# ---------------------------------------------------------------------------

STATIC_DIR = Path(__file__).parent / "static"

if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve index.html for all non-API routes (SPA catch-all)."""
        file_path = STATIC_DIR / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(STATIC_DIR / "index.html")
