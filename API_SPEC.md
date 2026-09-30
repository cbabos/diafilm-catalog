# Diafilm Catalog — API Contract & Shared Spec

## Overview
A two-container application: Fastify backend (TypeScript) + React frontend (TypeScript/Vite), behind an nginx reverse proxy. Deployed on a NAS at `http://192.168.68.117:19829`.

## Architecture
```
Client → nginx:19829 → /api/* → backend:3001
                     → /*     → frontend:80 (Vite preview / static)
```

## Data Models

### Product
```typescript
interface Product {
  id: number;
  title: string;
  handle: string;
  url: string;
  variantId: number;
  price: number;           // HUF, e.g. 1690
  compareAtPrice: number | null;  // original price if on sale, null otherwise
  available: boolean;
  tags: string[];
  productType: string;
  vendor: string;
  imageUrl: string | null;
}
```

### BoughtItem (enriched snapshot)
```typescript
interface BoughtItem {
  id: number;              // product ID
  boughtAt: string;        // ISO timestamp
  product: Product;        // full snapshot at time of purchase
}
```

### PriceHistoryEntry
```typescript
interface PriceHistoryEntry {
  id: number;
  title: string;
  price: number;
  compareAtPrice: number | null;
  date: string;            // YYYY-MM-DD
}
```

### DisappearedProduct
```typescript
interface DisappearedProduct {
  id: number;
  title: string;
  lastPrice: number;
  lastSeen: string;        // YYYY-MM-DD
  disappearedOn: string;   // YYYY-MM-DD
}
```

## API Endpoints

### Products
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/products` | Returns `Product[]` — all products from current scrape |

### Bought (collection)
| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | `/api/bought` | — | Returns `BoughtItem[]` |
| POST | `/api/bought` | `BoughtItem[]` | Replace entire bought list |

### Selection (shared wishlist)
| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | `/api/selection` | — | Returns `number[]` (product IDs) |
| POST | `/api/selection` | `number[]` | Replace entire selection |

### Price History
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/price-history` | Returns `PriceHistoryEntry[]` (all entries) |
| GET | `/api/price-history/:id` | Returns `PriceHistoryEntry[]` for one product |

### Disappeared Products
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/disappeared` | Returns `DisappearedProduct[]` |

### Order (cart assembly)
| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/api/order` | `{ variantIds: number[] }` | Assembles cart on diafilm.hu, returns checkout URL |

**Order response:**
```typescript
interface OrderResponse {
  ok: boolean;
  cartToken: string;
  checkoutUrl: string;
  itemCount: number;
  totalPrice: number;  // in fillér (Shopify format, divide by 100 for HUF)
}
```

## Backend Responsibilities
1. Serve all API endpoints above
2. Auto-re-scrape products from `https://diafilm.hu/products.json?limit=250&page=N` if `products.json` is older than 24h
3. Track price changes (append-only to `price_history.json`, only on changes)
4. Track disappeared products (to `products_seen.json`)
5. Migrate legacy bare-ID `bought.json` to enriched snapshot format on startup
6. Assemble Shopify carts via `POST https://diafilm.hu/cart/add.js` with batch `items[N][id]=variantId` format
7. Data stored as JSON files in `/data` directory (prepared for future DB migration via repository pattern)

## Frontend Responsibilities
1. Searchable, mobile-first product catalog with dark theme
2. Accent-insensitive search (Hungarian: á→a, ö→o, etc.)
3. Sorting: Device (id 8462548992273) first → On Sale → Alphabetical
4. Selection via checkbox (not card click); card click (title/image) opens product page in new tab
5. Filters: All / On Sale / Selected / Bought / Hide-Bought toggle
6. 3-step order flow: Assemble cart → Open checkout → Confirm/Cancel
7. Bought items show price paid + date; price change indicator if current price differs
8. Remove from bought (un-buy) with confirmation modal
9. Price history popup (📈 icon on cards with >1 history entry)
10. Discontinued badge ("Nem elérhető") for products no longer in scrape
11. Server-side selection persistence (shared family-wide)

## Special Product IDs
- **Projector**: `8462548992273` — always pinned to top of list (unless bought or searching)

## Shopify Cart API Reference
- Base: `https://diafilm.hu`
- Add to cart: `POST /cart/add.js` with `items[0][id]=VARIANT_ID&items[0][quantity]=1`
- Get cart: `GET /cart.js`
- Checkout: `GET /checkout` (returns 302 redirect to Shopify checkout URL)
- Products API: `GET /products.json?limit=250&page=N`