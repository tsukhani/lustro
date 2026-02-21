# 🪞 Lustro

A modern web UI for [czkawka_cli](https://github.com/qarmin/czkawka) — the powerful Rust-based file cleanup engine. All the scanning power of czkawka with a clean, responsive interface you actually want to use.

> *"Lustro"* means *mirror* in Polish 🇵🇱 — fitting for a tool that finds duplicate mirrors of your files.

<!-- Screenshot will be added after first deployment -->

## ✨ Features

- **10 Scan Types** — Duplicate files, similar images, similar videos, similar music, empty directories, empty files, temporary files, broken symlinks, bad extensions, broken files
- **Modern Web UI** — Clean dashboard, dark/light theme, responsive design
- **Interactive Results** — Grouped view, image thumbnails, smart selection (keep newest/oldest/largest/smallest)
- **Real-time Progress** — WebSocket-powered live updates during scans
- **Safe Deletion** — Trash with restore support, confirmation dialogs, no accidental mass-deletes
- **Storage Overview** — Disk usage per mounted volume at a glance
- **Docker-ready** — Single container, perfect for NAS deployment (Synology, TrueNAS, Unraid)

## 🚀 Quick Start

### Docker Compose

```yaml
services:
  lustro:
    image: lustro:latest
    ports:
      - "8080:8080"
    volumes:
      - ./config:/config
      - /path/to/your/files:/storage/files:rw
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=UTC
    restart: unless-stopped
```

### Docker Run

```bash
docker run -d \
  --name lustro \
  -p 8080:8080 \
  -v /path/to/config:/config \
  -v /path/to/files:/storage/files:rw \
  -e PUID=1000 -e PGID=1000 -e TZ=UTC \
  --restart unless-stopped \
  lustro:latest
```

Then open **http://localhost:8080** in your browser.

### Synology NAS

Deploy via Container Manager or Portainer. Mount your NAS volumes:

| Host Path | Container Path | Description |
|-----------|---------------|-------------|
| `/volume1/docker/lustro/config` | `/config` | Persistent config & scan cache |
| `/volume1/video` | `/storage/video` | Video library |
| `/volume1/music` | `/storage/music` | Music library |
| `/volume1/photo` | `/storage/photo` | Photo library |

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│              Docker Container                │
│                                              │
│  ┌──────────────┐    ┌───────────────────┐  │
│  │  React App   │◄──►│  FastAPI Server   │  │
│  │  (Tailwind)  │    │  (Python 3.12)    │  │
│  │  Port 8080   │    │                   │  │
│  └──────────────┘    │  ┌─────────────┐  │  │
│                      │  │ czkawka_cli │  │  │
│                      │  │ (Rust bin)  │  │  │
│                      │  └─────────────┘  │  │
│                      └───────────────────┘  │
│                                              │
│  /config  → scan results, settings, cache    │
│  /storage → your files (read-write)          │
└─────────────────────────────────────────────┘
```

- **Engine:** [czkawka_cli](https://github.com/qarmin/czkawka) handles all scanning — battle-tested, fast, accurate
- **Backend:** Python FastAPI with WebSocket support for real-time progress
- **Frontend:** React + Tailwind CSS + shadcn/ui components

## 🛠️ Development

### Prerequisites
- Node.js 22+
- Python 3.12+
- Docker (for building the image)

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev  # Vite dev server with API proxy to :8000
```

### Run Tests
```bash
cd backend && python -m pytest tests/ -v
cd frontend && npm run build  # TypeScript check
```

### Build Docker Image
```bash
docker build -t lustro:latest .
```

## 📋 Scan Types

| Scan | What it finds | Engine |
|------|--------------|--------|
| 🔁 Duplicate Files | Identical files by hash (Blake3/SHA256) | `czkawka_cli duplicates` |
| 🖼️ Similar Images | Visually similar images (perceptual hash) | `czkawka_cli similar-images` |
| 🎬 Similar Videos | Similar video files | `czkawka_cli similar-videos` |
| 🎵 Similar Music | Similar audio by tags/content | `czkawka_cli similar-music` |
| 📁 Empty Directories | Folders with nothing in them | `czkawka_cli empty-dirs` |
| 📄 Empty Files | Zero-byte files | `czkawka_cli empty-files` |
| 🗑️ Temporary Files | Temp/cache files | `czkawka_cli temporary` |
| 🔗 Broken Symlinks | Symlinks pointing nowhere | `czkawka_cli symlinks` |
| ⚠️ Bad Extensions | Files with wrong extensions | `czkawka_cli bad-extensions` |
| 💔 Broken Files | Corrupted/unreadable files | `czkawka_cli broken` |

## 🤝 Credits

- [czkawka](https://github.com/qarmin/czkawka) by Rafał Mikrut — the incredible Rust engine that powers all scanning
- [shadcn/ui](https://ui.shadcn.com/) — beautiful React components
- [FastAPI](https://fastapi.tiangolo.com/) — modern Python web framework

## 📄 License

MIT
