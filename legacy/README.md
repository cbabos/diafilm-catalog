# Legacy — Monolithic Python Version

This directory contains the original monolithic version of the diafilm catalog app, preserved for reference.

## What's here

| File | Purpose |
|------|---------|
| `server.py` | Python HTTP server (all API endpoints + scraper + cart assembly + migration) |
| `scraper.py` | Early regex-based HTML scraper (superseded by `scraper_api.py`) |
| `scraper_api.py` | Shopify products.json API scraper (the one that was used) |
| `index.html` | Single-file SPA (all HTML/CSS/JS in one file) |
| `start.sh` | Local launch script (`python3 server.py`) |
| `Dockerfile` | Original single-container Docker build (python:3.12-slim) |
| `products.json` | Data snapshot from Sept 30, 2026 (323 products) |
| `bought.json` | Empty — sample data was cleaned before archiving |
| `selected.json` | Empty — sample data was cleaned before archiving |
| `price_history.json` | Empty — no price changes had been tracked yet |
| `products_seen.json` | Empty — no products had disappeared yet |

## How it evolved

1. `server.py` started as a simple file server + API
2. Features were iteratively added: accent-insensitive search, server-side selection, price history, bought snapshots, 3-step order flow, remove-from-bought
3. The app was containerized with the `Dockerfile` here (single container, port 8765)
4. The whole thing was then rebuilt as a two-container architecture (Fastify backend + React frontend + nginx proxy) — see the parent directory

## Do not modify

This code is reference-only. All active development happens in `../backend/` and `../frontend/`.