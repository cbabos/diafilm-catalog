# Backend Phase Spec — Fastify + TypeScript

## Goal
Build a Fastify backend in `~/work/diafilm-app/backend/` that serves the API defined in `API_SPEC.md`.

## Tech Stack
- **Runtime**: Node.js 20+ (use `node:20-slim` Docker base)
- **Framework**: Fastify 5.x
- **Language**: TypeScript 5.x (strict mode)
- **Testing**: Vitest + supertest (via fastify.inject)
- **Linting**: ESLint + Prettier
- **Build**: tsup or tsx for dev, tsc for production

## Requirements

### 1. Project structure (SOLID, repository pattern for DB migration readiness)
```
backend/
├── src/
│   ├── index.ts              # Entry point: start Fastify server
│   ├── server.ts             # Fastify instance setup + plugin registration
│   ├── config.ts             # Env vars, port, data dir, rescrape interval
│   ├── types.ts              # Shared TypeScript types (Product, BoughtItem, etc.)
│   ├── plugins/
│   │   └── dataPlugin.ts     # Fastify plugin that decorates server with repositories
│   ├── repositories/
│   │   ├── ProductRepository.ts     # Interface + JSON impl
│   │   ├── BoughtRepository.ts       # Interface + JSON impl
│   │   ├── SelectionRepository.ts    # Interface + JSON impl
│   │   ├── PriceHistoryRepository.ts # Interface + JSON impl
│   │   └── DisappearedRepository.ts  # Interface + JSON impl
│   ├── services/
│   │   ├── ScraperService.ts    # Shopify products.json scraping + auto-rescrape
│   │   ├── CartService.ts       # Shopify cart/add.js + checkout URL retrieval
│   │   └── MigrationService.ts  # Migrate legacy bare-ID bought.json
│   ├── routes/
│   │   ├── products.ts          # GET /api/products
│   │   ├── bought.ts            # GET/POST /api/bought
│   │   ├── selection.ts         # GET/POST /api/selection
│   │   ├── priceHistory.ts      # GET /api/price-history, GET /api/price-history/:id
│   │   ├── disappeared.ts       # GET /api/disappeared
│   │   └── order.ts             # POST /api/order
│   └── utils/
│       └── normalize.ts         # Hungarian accent-insensitive normalize for sorting
├── tests/
│   ├── unit/
│   │   ├── repositories.test.ts
│   │   ├── scraperService.test.ts
│   │   ├── normalize.test.ts
│   │   └── migrationService.test.ts
│   ├── integration/
│   │   ├── routes.test.ts       # Full route tests with fastify.inject
│   │   └── orderFlow.test.ts
│   └── fixtures/
│       └── mockProducts.json
├── Dockerfile
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── .eslintrc.json
```

### 2. Repository pattern (DB-ready)
Each repository implements an interface. Current impl: JSON files in `/data`. Future: swap to PostgreSQL/MongoDB by implementing the same interface.

```typescript
// Example interface
export interface IProductRepository {
  getAll(): Promise<Product[]>;
  saveAll(products: Product[]): Promise<void>;
  getById(id: number): Promise<Product | null>;
}
```

### 3. Scraper service
- Fetches from `https://diafilm.hu/products.json?limit=250&page=N`
- Paginates until empty response
- Sorts with Hungarian accent-insensitive normalization
- On startup: if products.json missing or >24h old, re-scrape
- After re-scrape: diff prices → append to price_history.json, check disappeared → append to products_seen.json

### 4. Cart service
- POST to `https://diafilm.hu/cart/add.js` with batch items format
- Cookie jar for session
- GET `https://diafilm.hu/checkout` with no-redirect handler to capture 302 Location
- Returns checkout URL

### 5. Migration service
- On startup, check if bought.json contains bare IDs (numbers) vs enriched (objects with `boughtAt`)
- If bare IDs: cross-reference with products.json, build snapshots, save enriched format
- If product not found: check disappeared list, or use stub

### 6. Error handling
- Fastify error handler plugin
- Consistent error shape: `{ error: string, code?: string }`
- 404 for unknown routes, 400 for bad input, 500 for server errors

### 7. Dockerfile
```dockerfile
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-slim
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
ENV DATA_DIR=/data
ENV PORT=3001
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

### 8. Existing data to migrate
The NAS already has data files at `/opt/diafilm-app/data/`:
- `products.json` (323 products, current scrape)
- `bought.json` (currently empty, enriched format ready)
- `selected.json` (currently empty)
- `price_history.json` (may not exist yet)
- `products_seen.json` (may not exist yet)

The backend should create any missing files on startup.

### 9. Tests — minimum coverage
- Unit: each repository (CRUD with temp files)
- Unit: normalize function (Hungarian accent cases)
- Unit: scraper service (mock HTTP calls)
- Unit: migration service (bare ID → enriched)
- Integration: every route (GET/POST with fastify.inject)
- Integration: order flow (mock Shopify API)

### 10. Health check
`GET /api/health` → `{ status: "ok", products: N, uptime: seconds }`