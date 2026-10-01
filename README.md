# 🎬 Diafilm Katalógus

A web application for browsing, selecting, and ordering diafilms (slide films) from [diafilm.hu](https://diafilm.hu). Built as a two-container architecture with a Fastify backend and React frontend behind an nginx reverse proxy.

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

### Containers

| Container | Tech | Port | Purpose |
|-----------|------|------|---------|
| `diafilm-backend` | Fastify 5 + TypeScript | 3001 (internal) | API server, scraper, cart assembly |
| `diafilm-frontend` | React 19 + Vite 6 + TypeScript | 80 (internal) | SPA served by nginx |
| `diafilm-nginx` | nginx:alpine | 19829 → 80 | Reverse proxy: `/api/*` → backend, `/*` → frontend |

### Data Persistence

All runtime data is stored in `/opt/diafilm-app/data/` on the NAS, mounted as a volume to the backend container at `/data`:

| File | Purpose |
|------|---------|
| `products.json` | Current product catalog (323 items, auto-re-scraped daily) |
| `bought.json` | Purchased items with full product snapshots + timestamps |
| `selected.json` | Shared family-wide selection (product IDs) |
| `price_history.json` | Append-only log of price changes |
| `products_seen.json` | Disappeared products log |

## Features

- **Searchable catalog** — 323 diafilms with accent-insensitive search (Hungarian: á→a, ö→o)
- **Sorting** — Device (projector) → On Sale → Alphabetical
- **Selection** — Checkbox-based, persisted server-side (shared across family devices)
- **Product links** — Click title/image opens the product page on diafilm.hu in a new tab
- **Sale filter** — Filter to show only discounted items
- **3-step order flow** — Assemble cart on diafilm.hu → Open checkout → Confirm/Cancel
- **Bought tracking** — Full product snapshots with price paid + date; price change indicators
- **Price history** — 📈 icon on cards with >1 history entries; click to see timeline
- **Discontinued products** — "Nem elérhető" badge for products removed from diafilm.hu
- **Remove from bought** — Select bought items → red "Eltávolít" button → confirm to un-buy
- **Auto re-scrape** — If products.json is older than 24h, re-scrape on container startup

## Tech Stack

### Backend (`/backend`)
- **Runtime**: Node.js 20+
- **Framework**: Fastify 5
- **Language**: TypeScript 5 (strict mode)
- **Testing**: Vitest (90 tests)
- **Architecture**: Repository pattern (JSON file implementations, DB-ready interfaces)
- **Services**: ScraperService, CartService, MigrationService

### Frontend (`/frontend`)
- **Framework**: React 19 + TypeScript 5 (strict)
- **Build**: Vite 6
- **State**: TanStack Query (server) + Zustand (UI)
- **Styling**: CSS Modules, dark theme, mobile-first responsive
- **Testing**: Vitest + React Testing Library (119 tests)

### Infrastructure
- **Reverse proxy**: nginx:alpine
- **Container orchestration**: Docker Compose
- **Deployment**: NAS (Synology) via SSH

## Project Structure

```
diafilm-app/
├── backend/              # Fastify API server
│   ├── src/
│   │   ├── routes/       # API endpoint handlers
│   │   ├── repositories/ # Data access (repository pattern)
│   │   ├── services/     # Business logic (scraper, cart, migration)
│   │   ├── plugins/      # Fastify plugins
│   │   ├── utils/        # Hungarian normalize, sorting
│   │   └── types.ts      # Shared TypeScript types
│   ├── tests/            # Unit + integration tests
│   └── Dockerfile
├── frontend/             # React SPA
│   ├── src/
│   │   ├── components/   # 10 reusable components with CSS Modules
│   │   ├── api/          # TanStack Query hooks
│   │   ├── hooks/        # Custom hooks (useDebounce, useLocalFilter)
│   │   ├── store/        # Zustand UI store
│   │   ├── utils/        # Normalize, sort, format
│   │   └── types/        # TypeScript types
│   ├── tests/            # Component + integration tests
│   └── Dockerfile
├── nginx/                # Reverse proxy config
│   └── default.conf
├── legacy/               # Original monolithic Python version (reference only)
│   ├── server.py
│   ├── scraper.py
│   ├── scraper_api.py
│   ├── index.html
│   └── start.sh
├── docker-compose.yml    # 3-container orchestration
├── API_SPEC.md           # Shared API contract
├── BACKEND_SPEC.md       # Backend phase spec
├── FRONTEND_SPEC.md      # Frontend phase spec
├── INFRA_SPEC.md         # Infrastructure spec
└── AGENTS.md             # AI agent instructions
```

## Development

### Prerequisites
- Node.js 20+
- Docker + Docker Compose

### Local Development

**Backend:**
```bash
cd backend
npm install
npm run dev      # Starts on http://localhost:3001
npm test         # Run 90 tests
npm run build    # Compile to dist/
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev      # Starts Vite dev server with /api proxy to localhost:3001
npm test         # Run 119 tests
npm run build    # Production build to dist/
```

### Deployment to NAS

```bash
# Copy source to NAS
scp -P 1922 -r backend/ frontend/ nginx/ docker-compose.yml root@192.168.68.117:/opt/diafilm-app/

# Build and start containers
ssh -p 1922 root@192.168.68.117 'cd /opt/diafilm-app && docker compose up -d --build'
```

The app is then available at `http://192.168.68.117:19829`.

### Data Migration

The backend automatically migrates legacy `bought.json` (bare ID arrays) to enriched snapshot format on startup. No manual intervention needed.

## API Reference

See [`API_SPEC.md`](./API_SPEC.md) for the complete API contract.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/products` | All products |
| GET | `/api/bought` | Bought items with snapshots |
| POST | `/api/bought` | Replace bought list |
| GET | `/api/selection` | Selected product IDs |
| POST | `/api/selection` | Replace selection |
| GET | `/api/price-history` | All price history entries |
| GET | `/api/price-history/:id` | Price history for one product |
| GET | `/api/disappeared` | Disappeared products |
| POST | `/api/order` | Assemble Shopify cart, get checkout URL |

## License

Private project. All rights reserved.