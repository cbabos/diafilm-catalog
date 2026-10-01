# AGENTS.md — AI Agent Instructions for Diafilm Catalog

> This file provides context and instructions for AI agents working on this codebase.

## Project Overview

A two-container web application for browsing and ordering diafilms from diafilm.hu (a Hungarian Shopify store). The app allows a family to collaboratively browse 323+ products, select items into a shared wishlist, assemble carts on diafilm.hu, and track purchases with price history.

## Architecture

Three Docker containers behind an nginx reverse proxy:

1. **Backend** (`/backend`): Fastify 5 + TypeScript. Serves the API, scrapes products from Shopify, assembles carts, tracks price history and disappeared products. Uses the repository pattern with JSON file storage (DB-ready interfaces for future migration).

2. **Frontend** (`/frontend`): React 19 + TypeScript + Vite. Mobile-first dark-themed SPA. TanStack Query for server state, Zustand for UI state. CSS Modules per component.

3. **Nginx** (`/nginx`): Reverse proxy. Routes `/api/*` to backend, `/*` to frontend.

## Key Domain Knowledge

### diafilm.hu Shopify API
- Products: `GET https://diafilm.hu/products.json?limit=250&page=N` — paginated, returns all products
- Cart: `POST https://diafilm.hu/cart/add.js` with `items[N][id]=VARIANT_ID&items[N][quantity]=1` — batch add
- Cart info: `GET https://diafilm.hu/cart.js`
- Checkout: `GET https://diafilm.hu/checkout` — returns 302 redirect to Shopify checkout URL
- No authentication needed for cart assembly (guest checkout supported)

### Hungarian-Specific Concerns
- **Accented characters**: á é í ó ö ő ú ü ű — search and sort must be accent-insensitive
- **Normalization**: Use `String.normalize('NFD')` then strip combining marks (`\u0300-\u036f`)
- **Sorting locale**: Use `'hu'` locale for `localeCompare`
- **compareAtPrice edge case**: Shopify returns `0` (not `null`) for non-sale products. Always check `compareAtPrice != null && compareAtPrice > 0`

### Special Product
- **Projector** (ID: `8462548992273`): Always pinned to top of list unless bought or searching. It's the diavetítő device, not a movie.

### Data Formats
- **bought.json**: Enriched snapshots — `[{ id, boughtAt: ISO timestamp, product: { full Product } }]`. NOT bare IDs. The MigrationService upgrades legacy bare-ID format on startup.
- **price_history.json**: Append-only — entries only added when price changes between scrapes
- **products_seen.json**: Logs products that disappeared from diafilm.hu between scrapes
- **selected.json**: Simple `number[]` of product IDs (transient selection state)

## Coding Standards

### Backend
- TypeScript strict mode
- Repository pattern: all data access through interfaces (`IProductRepository`, `IBoughtRepository`, etc.)
- Current implementations use JSON files via `JsonFileStore`. To migrate to a database, implement the same interfaces.
- Services contain business logic (ScraperService, CartService, MigrationService)
- Routes are thin — delegate to repositories via `fastify.repos`
- Error shape: `{ error: string, code?: string }`
- Test every route with `fastify.inject()` (integration tests)

### Frontend
- TypeScript strict mode
- Reusable components with explicit prop interfaces (see FRONTEND_SPEC.md for component contracts)
- CSS Modules per component (no global styles except `globals.css`)
- TanStack Query for all server state (caching + invalidation)
- Zustand for UI-only state (filter, search, modal open/close)
- Test every component with React Testing Library
- Dark theme CSS variables defined in `globals.css`

### General
- SOLID principles
- No magic numbers — use named constants (e.g., `PROJECTOR_ID`)
- Functions should be small and testable
- Prefer composition over inheritance

## Testing
- **Backend**: `cd backend && npm test` — 90 tests (unit + integration)
- **Frontend**: `cd frontend && npm test` — 119 tests (unit + component + integration)
- All tests must pass before deploying

## Deployment
- Target: NAS at `192.168.68.117` port `1922` (SSH key auth, no password)
- App URL: `http://192.168.68.117:19829`
- Data volume: `/opt/diafilm-app/data/` (persistent across container rebuilds)
- Deploy command: `scp -P 1922 <files> root@192.168.68.117:/opt/diafilm-app/ && ssh -p 1922 root@192.168.68.117 'cd /opt/diafilm-app && docker compose up -d --build'`

## Files of Interest

| File | Purpose |
|------|---------|
| `API_SPEC.md` | Complete API contract — both containers work against this |
| `BACKEND_SPEC.md` | Backend architecture, project structure, requirements |
| `FRONTEND_SPEC.md` | Frontend component contracts, features, requirements |
| `INFRA_SPEC.md` | Docker Compose topology, nginx config, deployment |
| `legacy/` | Original monolithic Python version (server.py + index.html). Reference only — do not modify. |

## Common Tasks

### Add a new API endpoint
1. Define the route in `backend/src/routes/`
2. Register it in `backend/src/server.ts`
3. Add types to `backend/src/types.ts` if needed
4. Write integration test in `backend/tests/integration/`
5. Add TanStack Query hook in `frontend/src/api/`
6. Use the hook in the relevant component

### Change data storage from JSON to database
1. Implement the repository interfaces (e.g., `IProductRepository`) with DB client
2. Register the new implementations in `dataPlugin.ts`
3. No route or frontend changes needed — repositories are the seam

### Re-scrape products manually
```bash
ssh -p 1922 root@192.168.68.117 'docker restart diafilm-backend'
```
The backend checks if products.json is >24h old on startup and re-scrapes if needed.

### Update frontend UI
1. Edit components in `frontend/src/components/`
2. Run `npm test` to verify component tests pass
3. Run `npm run build` to verify production build
4. Deploy: `scp -P 1922` the changed files + `docker compose up -d --build frontend`

## Do Not
- Do not modify `legacy/` — it's the reference implementation
- Do not store credentials in the repo (NAS SSH keys, Shopify tokens)
- Do not expose backend port externally — only through nginx
- Do not commit `data/` directory contents — they're runtime state
- Do not commit `node_modules/` or `dist/`