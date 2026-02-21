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

# Install czkawka_cli (v11.0.1 x86_64)
RUN apt-get update && apt-get install -y --no-install-recommends wget ca-certificates && \
    wget -O /usr/local/bin/czkawka_cli https://github.com/qarmin/czkawka/releases/download/11.0.1/linux_czkawka_cli_x86_64 && \
    chmod +x /usr/local/bin/czkawka_cli && \
    apt-get purge -y wget && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend
COPY backend/ .

# Copy frontend build
COPY --from=frontend /build/dist /app/static

# Create default directories
RUN mkdir -p /config/scans /config/trash /config/thumbnails

ENV PUID=1000
ENV PGID=1000
ENV TZ=UTC
ENV TRASH_DIR=/config/trash
ENV CONFIG_DIR=/config
ENV STORAGE_ROOT=/storage

EXPOSE 8080
VOLUME ["/config", "/storage"]

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
