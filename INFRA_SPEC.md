# Infrastructure Spec — Nginx + Docker Compose

## Architecture
```
                    ┌──────────────────────────────────────────┐
                    │           NAS: 192.168.68.117            │
                    │           Port: 19829                    │
                    │                                          │
  Client ──────────┼──→ nginx ──→ /api/*  ──→ backend:3001    │
                    │            ──→ /*      ──→ frontend:80   │
                    │                                          │
                    │  Volumes:                                │
                    │    /opt/diafilm-app/data → backend:/data │
                    └──────────────────────────────────────────┘
```

## nginx config
- Listen on port 80 (internal to Docker network)
- `location /api/` → `proxy_pass http://backend:3001;`
- `location /` → serve from `/usr/share/nginx/html` (frontend static files)
- SPA fallback: `try_files $uri $uri/ /index.html;`
- Proxy headers: X-Real-IP, X-Forwarded-For, X-Forwarded-Proto, Host

## docker-compose.yml
```yaml
services:
  backend:
    build: ./backend
    container_name: diafilm-backend
    volumes:
      - ./data:/data
    restart: unless-stopped
    environment:
      - DATA_DIR=/data
      - PORT=3001
    # No port exposed externally — only through nginx

  frontend:
    build: ./frontend
    container_name: diafilm-frontend
    restart: unless-stopped
    # No port exposed externally — only through nginx
    depends_on:
      - backend

  nginx:
    image: nginx:alpine
    container_name: diafilm-nginx
    ports:
      - "19829:80"
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - frontend
      - backend
    restart: unless-stopped
```

## Deployment
1. Copy all files to NAS: `/opt/diafilm-app/`
2. Existing data stays at `/opt/diafilm-app/data/`
3. `docker compose up -d --build`
4. App accessible at `http://192.168.68.117:19829`