# Project Context — Diafilm Catalog

> Historical context and design decisions for the diafilm catalog project.
> Useful for onboarding new contributors or AI agents.

## Timeline

### Phase 1: Monolithic Python App (Sept 30, 2026)
- Started as a single-file Python HTTP server (`server.py`) + static HTML (`index.html`)
- Scraped 323 products from diafilm.hu via Shopify's `/products.json` API
- All state stored in JSON files (`products.json`, `bought.json`, `selected.json`)
- Deployed as a single Docker container on a NAS at `192.168.68.117:19829`

### Phase 2: Feature Iterations
1. **Accent-insensitive search** — Hungarian accented characters (á, é, í, ó, ö, ő, ú, ü, ű) normalized via `String.normalize('NFD')` + combining mark stripping
2. **Accent-insensitive sorting** — Products sorted with normalized localeCompare using `'hu'` locale
3. **Projector pinning** — Diavetítő (ID: 8462548992273) pinned to position #1 in list
4. **Server-side selection** — Moved from localStorage to `selected.json` for family-wide sharing
5. **Sale filter + sorting** — "Akciós" filter button; sort order: Device → On Sale → Alphabetical
6. **Auto re-scrape** — If products.json older than 24h, re-scrape on startup
7. **Price history** — Append-only `price_history.json`, only logs on price changes
8. **Disappeared products** — `products_seen.json` tracks products removed from diafilm.hu
9. **Bought snapshots** — `bought.json` stores full product data + timestamp at purchase time
10. **3-step order flow** — Assemble cart → Checkout link → Confirm/Cancel (no auto-assumptions)
11. **Remove from bought** — Select bought items → "Eltávolít" button → confirmation modal
12. **Docker containerization** — Containerized and deployed to NAS
13. **Clickable cards** — Checkbox for selection, title/image open product page in new tab

### Phase 3: Two-Container Architecture (Sept 30, 2026)
- Rebuilt as Fastify backend (TypeScript) + React frontend (TypeScript/Vite) + nginx reverse proxy
- Backend: 90 tests, repository pattern (DB-ready), services for scraper/cart/migration
- Frontend: 119 tests, 10 reusable components, TanStack Query + Zustand
- Deployed as 3 Docker containers on NAS
- Original Python code preserved in `legacy/` for reference

## Key Design Decisions

### Why Shopify products.json instead of HTML scraping?
The Shopify `/products.json` endpoint provides structured JSON with all product data (title, price, variant ID, tags, images). It's more reliable than HTML parsing and doesn't break when the store changes its UI. The endpoint is publicly accessible without authentication.

### Why JSON files instead of a database?
The app runs on a NAS with limited resources. JSON files are simple, portable, and sufficient for 323 products + small selection/bought lists. The backend uses the repository pattern with interfaces, so migrating to PostgreSQL or MongoDB later requires only implementing the same interfaces — no route or frontend changes.

### Why server-side selection instead of localStorage?
Multiple family members browse the catalog on different devices (phones, tablets). Server-side `selected.json` means when one person selects a movie, everyone sees it. This enables collaborative wishlist building.

### Why 3-step order flow instead of auto-marking as bought?
The app cannot receive webhooks from Shopify (NAS is local-only, no public URL). The 3-step flow (Assemble → Checkout → Confirm/Cancel) ensures items are only marked as bought when the user explicitly confirms, preserving the selection if checkout is abandoned.

### Why full product snapshots in bought.json?
Products on diafilm.hu can be removed or price-changed at any time. Storing the full product data at purchase time ensures the "Megvett" (bought) view always renders correctly, even for discontinued products. The snapshot includes title, price, image URL, tags, and variant ID.

### Why compareAtPrice > 0 check?
Shopify returns `compareAtPrice: 0` (not `null`) for some non-sale products. Without the `> 0` check, these show as "0 Ft --Infinity%" sale items. The fix: `compareAtPrice != null && compareAtPrice > 0` everywhere sale status is evaluated.

### Why nginx reverse proxy instead of CORS?
The nginx reverse proxy routes `/api/*` to the backend and `/*` to the frontend, making both same-origin. This eliminates CORS complexity and keeps the backend port internal to the Docker network (not exposed externally).

## External Dependencies

| Service | URL | Auth | Purpose |
|---------|-----|------|---------|
| diafilm.hu Shopify API | `https://diafilm.hu/products.json` | None | Product scraping |
| diafilm.hu Cart API | `https://diafilm.hu/cart/add.js` | Cookie session | Cart assembly |
| diafilm.hu Checkout | `https://diafilm.hu/checkout` | Cookie session | Checkout redirect |
| NAS SSH | `root@192.168.68.117:1922` | SSH key | Deployment |

## Environment Variables

### Backend
| Variable | Default | Description |
|----------|---------|-------------|
| `DATA_DIR` | Project root (dev) / `/data` (Docker) | Path to JSON data files |
| `PORT` | `3001` | Backend server port |
| `RESCRAPE_MAX_AGE` | `86400` (24h) | Max age of products.json before re-scrape (seconds) |
| `SHOPIFY_BASE_URL` | `https://diafilm.hu` | Shopify store base URL |
| `USER_AGENT` | Mozilla string | User agent for Shopify API requests |

### Frontend
No environment variables — all API calls go through `/api/*` (same origin via nginx).

## Deployment Topology

```
NAS (192.168.68.117)
├── /opt/diafilm-app/
│   ├── backend/          # Backend source
│   ├── frontend/         # Frontend source
│   ├── nginx/
│   │   └── default.conf  # Reverse proxy config
│   ├── docker-compose.yml
│   └── data/             # Persistent data volume
│       ├── products.json
│       ├── bought.json
│       ├── selected.json
│       ├── price_history.json
│       └── products_seen.json
│
└── Docker containers:
    ├── diafilm-backend   (Fastify, port 3001 internal)
    ├── diafilm-frontend  (nginx serving React SPA, port 80 internal)
    └── diafilm-nginx     (reverse proxy, port 19829 → 80)
```