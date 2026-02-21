# Czkawka Web UI — Project Specification

## Overview
A modern web UI wrapper around `czkawka_cli` — the battle-tested Rust-based file cleanup engine. All scanning/detection logic comes from czkawka_cli. We build the web interface.

Deployed as a single Docker container on a Synology NAS.

## Architecture

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
│                      │  │ (binary)    │  │  │
│                      │  └─────────────┘  │  │
│                      └───────────────────┘  │
│                                              │
│  Volumes:                                    │
│    /config  → persistent config/cache        │
│    /storage → NAS folders (video, music etc) │
└─────────────────────────────────────────────┘
```

## Tech Stack
- **Engine:** czkawka_cli v8.x (download Linux x86_64 binary from GitHub releases)
- **Backend:** Python 3.12 + FastAPI + uvicorn
- **Frontend:** React 19 + Vite + Tailwind CSS 4 + shadcn/ui
- **WebSocket:** For real-time scan progress
- **Docker:** Multi-stage build, final image based on python:3.12-slim

## Backend (FastAPI)

### API Endpoints

#### Scan Management
```
POST   /api/scans              — Start a new scan
GET    /api/scans              — List all scans (history)
GET    /api/scans/{id}         — Get scan status & results
DELETE /api/scans/{id}         — Cancel a running scan
WS     /api/scans/{id}/ws     — Real-time progress stream
```

#### File Operations
```
POST   /api/files/delete       — Delete selected files
POST   /api/files/trash        — Move to trash folder
GET    /api/files/preview/{path} — Image thumbnail (resized)
```

#### System
```
GET    /api/storage/stats      — Disk usage per mount
GET    /api/config             — Get current config
PUT    /api/config             — Update config
GET    /api/health             — Health check
```

### Scan Types (map to czkawka_cli subcommands)
| UI Name | CLI Subcommand | Key Options |
|---------|---------------|-------------|
| Duplicate Files | `duplicates` | --search-method (hash/size/name), --min-size |
| Similar Images | `similar-images` | --similarity-preset (minimal/very_small/small/medium/high/very_high) |
| Similar Videos | `similar-videos` | --tolerance |
| Similar Music | `similar-music` | --music-similarity |
| Empty Directories | `empty-dirs` | — |
| Empty Files | `empty-files` | — |
| Temporary Files | `temporary` | — |
| Broken Symlinks | `symlinks` | — |
| Bad Extensions | `bad-extensions` | — |
| Broken Files | `broken` | --checked-types |

### How to invoke czkawka_cli
```python
import asyncio
import subprocess

# Example: find duplicates
proc = await asyncio.create_subprocess_exec(
    '/app/czkawka_cli', 'duplicates',
    '--directories', '/storage/video',
    '--excluded-directories', '/storage/video/@eaDir',
    '--search-method', 'hash',
    '--min-size', '1048576',  # 1MB
    '--json',  # JSON output for easy parsing
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE
)

# Stream stderr for progress, stdout for results
```

**IMPORTANT:** czkawka_cli supports `--json` flag for structured JSON output. Always use it.

### Scan State Machine
```
PENDING → RUNNING → COMPLETED
                  → FAILED
                  → CANCELLED
```

Store scan results in `/config/scans/` as JSON files for persistence.

## Frontend (React)

### Pages/Routes
1. **Dashboard** (`/`) — Storage overview, recent scans, quick actions
2. **Scan** (`/scan/:type`) — Configure and run a scan
3. **Results** (`/results/:scanId`) — View and act on scan results
4. **Settings** (`/settings`) — Configure paths, exclusions, preferences

### Dashboard
- Storage bars for each mounted volume (used/free/total)
- Recent scan cards (type, date, findings count, status)
- Quick scan buttons for common operations

### Scan Page
- Scan type selector (cards with icons)
- Path selector (checkboxes for mounted volumes under /storage/)
- Options panel (type-specific: min size, similarity, etc.)
- Exclusion patterns input
- "Start Scan" button
- Progress section: animated progress indicator, current file/directory, files processed count, elapsed time

### Results Page
- **Grouped display:** For duplicates, show groups. Each group = one "original" + copies
- **File cards:** filename, path, size, modified date, thumbnail (for images)
- **Selection:** Checkbox per file. Smart select buttons:
  - "Keep Newest" / "Keep Oldest" / "Keep Largest" / "Keep Smallest"
  - "Select All in Group Except First"
  - "Select All" / "Deselect All"
- **Actions toolbar:** Delete Selected, Move to Trash, Export CSV
- **Summary bar:** Total files, total size, selected count, selected size

### Design System
- Dark theme by default (NAS tools are usually used in dark environments)
- Light theme toggle
- Clean, spacious layout
- shadcn/ui components (buttons, cards, tables, dialogs, progress, toast)
- Responsive (works on tablet too)
- Color coding: danger=red for delete actions, info=blue for scans, success=green for completed

## Docker

### Dockerfile (multi-stage)
```dockerfile
# Stage 1: Build frontend
FROM node:22-slim AS frontend
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Stage 2: Production
FROM python:3.12-slim
WORKDIR /app

# Install czkawka_cli
RUN apt-get update && apt-get install -y --no-install-recommends wget ca-certificates && \
    wget -O /usr/local/bin/czkawka_cli https://github.com/qarmin/czkawka/releases/download/8.0.0/linux_czkawka_cli && \
    chmod +x /usr/local/bin/czkawka_cli && \
    apt-get purge -y wget && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend
COPY backend/ .

# Copy frontend build
COPY --from=frontend /build/dist /app/static

EXPOSE 8080
VOLUME ["/config", "/storage"]

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

### Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| `PUID` | `1000` | User ID for file operations |
| `PGID` | `1000` | Group ID for file operations |
| `TZ` | `UTC` | Timezone |
| `TRASH_DIR` | `/config/trash` | Trash folder location |

### Docker Compose (dev)
```yaml
services:
  czkawka-ui:
    build: .
    ports:
      - "8080:8080"
    volumes:
      - ./config:/config
      - /path/to/files:/storage/files
```

## File Structure
```
czkawka-ui/
├── SPEC.md
├── Dockerfile
├── docker-compose.yml
├── backend/
│   ├── main.py              # FastAPI app, routes, static serving
│   ├── scanner.py           # czkawka_cli wrapper, parse output
│   ├── file_ops.py          # Delete, trash, preview operations
│   ├── storage.py           # Disk stats, path management
│   ├── models.py            # Pydantic models
│   ├── config.py            # Config management
│   └── requirements.txt     # fastapi, uvicorn, aiofiles, pillow
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── components/
│       │   ├── layout/       # Sidebar, Header, ThemeToggle
│       │   ├── dashboard/    # StorageCard, RecentScans, QuickActions
│       │   ├── scan/         # ScanConfig, ScanProgress, PathSelector
│       │   └── results/      # ResultsTable, FileCard, ActionToolbar, GroupView
│       ├── pages/
│       │   ├── Dashboard.tsx
│       │   ├── Scan.tsx
│       │   ├── Results.tsx
│       │   └── Settings.tsx
│       ├── hooks/
│       │   ├── useScan.ts
│       │   ├── useWebSocket.ts
│       │   └── useStorage.ts
│       ├── lib/
│       │   ├── api.ts        # API client
│       │   └── utils.ts
│       └── types/
│           └── index.ts
└── config/                   # Runtime config (Docker volume)
```

## Key Implementation Notes

1. **czkawka_cli --json** outputs structured JSON. Parse this directly — don't try to parse human-readable output.

2. **Progress tracking:** czkawka_cli prints progress to stderr. Capture stderr line-by-line and forward via WebSocket.

3. **Large scans:** Video duplicate scans on TB of data can take hours. The WebSocket must stay alive. Add heartbeat pings.

4. **File previews:** Use Pillow to generate thumbnails for image files. Cache in /config/thumbnails/.

5. **Trash implementation:** Move files to /config/trash/ with metadata (original path, date). Support "restore" later.

6. **Default exclusions:** Always exclude: `@eaDir`, `.Trash-*`, `#recycle`, `.DS_Store`, `Thumbs.db`, `node_modules`

7. **Concurrent scans:** Only allow ONE scan at a time. Queue additional requests.

8. **Static serving:** FastAPI serves the React build from /app/static. Catch-all route for SPA routing.

## Testing

- Backend: pytest with httpx TestClient
- Frontend: Basic smoke tests (components render)
- Integration: Docker build succeeds, container starts, health endpoint responds
- Manual: Deploy to NAS, scan a test folder, verify results
