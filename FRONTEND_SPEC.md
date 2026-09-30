# Frontend Phase Spec — React + TypeScript + Vite

## Goal
Build a React frontend in `~/work/diafilm-app/frontend/` that provides the full diafilm catalog UI. Communicates with the Fastify backend via `/api/*` routes (through nginx reverse proxy).

## Tech Stack
- **Framework**: React 19 + TypeScript 5 (strict)
- **Build**: Vite 6
- **Testing**: Vitest + React Testing Library + jsdom
- **Styling**: CSS Modules (no external UI library — keep it lightweight, dark theme)
- **State**: React Query (TanStack Query) for server state + Zustand for local UI state
- **Linting**: ESLint + Prettier

## Requirements

### 1. Project structure (SOLID, reusable components)
```
frontend/
├── src/
│   ├── main.tsx              # React entry point
│   ├── App.tsx               # Root component, providers, layout
│   ├── api/
│   │   ├── client.ts          # Fetch wrapper with base URL + error handling
│   │   ├── products.ts        # Product API hooks (useProducts)
│   │   ├── bought.ts          # Bought API hooks (useBought, useUpdateBought)
│   │   ├── selection.ts       # Selection API hooks (useSelection, useUpdateSelection)
│   │   ├── priceHistory.ts    # Price history hooks (usePriceHistory)
│   │   └── order.ts           # Order API hook (useAssembleCart)
│   ├── components/
│   │   ├── Header/
│   │   │   ├── Header.tsx          # Sticky header with title + search
│   │   │   ├── Header.module.css
│   │   │   └── Header.test.tsx
│   │   ├── SearchBar/
│   │   │   ├── SearchBar.tsx       # Debounced search input
│   │   │   ├── SearchBar.module.css
│   │   │   └── SearchBar.test.tsx
│   │   ├── FilterBar/
│   │   │   ├── FilterBar.tsx       # Filter buttons (All/Sale/Selected/Bought/HideBought)
│   │   │   ├── FilterBar.module.css
│   │   │   └── FilterBar.test.tsx
│   │   ├── ProductCard/
│   │   │   ├── ProductCard.tsx     # Single product card (checkbox + link + badges)
│   │   │   ├── ProductCard.module.css
│   │   │   └── ProductCard.test.tsx
│   │   ├── ProductList/
│   │   │   ├── ProductList.tsx     # Virtualized grid of ProductCards
│   │   │   ├── ProductList.module.css
│   │   │   └── ProductList.test.tsx
│   │   ├── BottomBar/
│   │   │   ├── BottomBar.tsx       # Fixed bottom bar (count, total, buttons)
│   │   │   ├── BottomBar.module.css
│   │   │   └── BottomBar.test.tsx
│   │   ├── OrderModal/
│   │   │   ├── OrderModal.tsx      # 3-step order flow modal
│   │   │   ├── OrderModal.module.css
│   │   │   └── OrderModal.test.tsx
│   │   ├── RemoveBoughtModal/
│   │   │   ├── RemoveBoughtModal.tsx
│   │   │   ├── RemoveBoughtModal.module.css
│   │   │   └── RemoveBoughtModal.test.tsx
│   │   ├── PriceHistoryModal/
│   │   │   ├── PriceHistoryModal.tsx
│   │   │   ├── PriceHistoryModal.module.css
│   │   │   └── PriceHistoryModal.test.tsx
│   │   └── Modal/
│   │       ├── Modal.tsx           # Reusable modal shell (overlay + content)
│   │       ├── Modal.module.css
│   │       └── Modal.test.tsx
│   ├── hooks/
│   │   ├── useDebounce.ts          # Debounce hook for search
│   │   ├── useDebounce.test.ts
│   │   ├── useLocalFilter.ts       # Filter state (all/sale/selected/bought + hideBought)
│   │   └── useLocalFilter.test.ts
│   ├── utils/
│   │   ├── normalize.ts            # Hungarian accent-insensitive normalize
│   │   ├── normalize.test.ts
│   │   ├── sortProducts.ts         # Device → Sale → Alphabetical
│   │   ├── sortProducts.test.ts
│   │   └── format.ts               # Price formatting (hu-HU locale)
│   ├── store/
│   │   └── uiStore.ts              # Zustand: filter state, search term, modal state
│   ├── types/
│   │   └── index.ts                # Product, BoughtItem, PriceHistoryEntry, etc.
│   └── styles/
│       ├── globals.css             # CSS reset, dark theme variables, global styles
│       └── theme.ts                # Theme constants
├── public/
├── tests/
│   └── setup.ts                    # Vitest setup (jsdom, Testing Library)
├── Dockerfile
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
└── .eslintrc.json
```

### 2. Component contract (props for each component)

#### ProductCard
```typescript
interface ProductCardProps {
  product: Product;
  isSelected: boolean;
  isBought: boolean;
  boughtInfo?: { pricePaid: number; date: string } | null;
  priceHistoryCount: number;
  onToggleSelect: (id: number) => void;
  onShowPriceHistory: (id: number) => void;
}
```

#### FilterBar
```typescript
type FilterType = 'all' | 'sale' | 'selected' | 'bought';
interface FilterBarProps {
  currentFilter: FilterType;
  hideBought: boolean;
  selectedCount: number;
  boughtCount: number;
  onFilterChange: (filter: FilterType) => void;
  onToggleHideBought: () => void;
}
```

#### BottomBar
```typescript
interface BottomBarProps {
  selectedCount: number;
  selectedTotal: number;
  hasBoughtInSelection: boolean;
  onClearSelection: () => void;
  onOrder: () => void;
  onRemoveBought: () => void;
}
```

#### OrderModal (3-step flow)
```typescript
interface OrderModalProps {
  open: boolean;
  selectedProducts: Product[];
  onClose: () => void;
  onConfirm: () => Promise<void>;
}
```

### 3. Feature requirements (from previous iterations)
- **Search**: Accent-insensitive (Hungarian), debounced 150ms, matches title + tags
- **Sort**: Device (id 8462548992273) → On Sale (compareAtPrice != null) → Alphabetical
- **Selection**: Checkbox on left of card, NOT card click. Server-persisted via POST /api/selection
- **Card click**: Title + image open product URL in new tab
- **Bought display**: Green "✓ price (date)" + price change arrow if current price differs
- **Discontinued**: Grey "Nem elérhető" badge, no link
- **Price history**: 📈 icon if >1 history entries, opens modal with timeline
- **Order flow**: 3 steps (Assemble → Checkout link → Confirm/Cancel). Selection preserved until confirm.
- **Remove from bought**: Red "Eltávolít" button in BottomBar when selection contains bought items. Confirmation modal.
- **Filters**: All / Akciós (sale) / Kijelölt (selected) / Megvett (bought) + "Elrejti vásároltakat" toggle (active by default)
- **Hide bought**: Active by default in "All" filter. Bought items hidden unless in "Megvett" filter.

### 4. Dark theme (CSS variables — match existing design)
```css
--bg: #0f0f0f;
--card-bg: #1a1a2e;
--card-border: #2a2a3e;
--text: #e0e0e0;
--text-dim: #888;
--accent: #6c5ce7;
--accent-light: #a29bfe;
--green: #00b894;
--red: #e74c3c;
--price: #fdcb6e;
--sale: #e17055;
```

### 5. Mobile-first responsive grid
- 1 column on mobile (<600px)
- 2 columns on tablet (600px+)
- 3 columns on desktop (1000px+)

### 6. Dockerfile (multi-stage build → static files served by nginx)
```dockerfile
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

### 7. Tests — minimum coverage
- Unit: normalize, sortProducts, format utilities
- Unit: useDebounce, useLocalFilter hooks
- Component: each component renders correctly with various prop combinations
- Component: ProductCard (selected/bought/sale/discontinued states, checkbox click, link click)
- Component: FilterBar (active states, click handlers)
- Component: BottomBar (button visibility based on hasBoughtInSelection)
- Component: OrderModal (3-step flow transitions)
- Integration: App renders ProductList with mock API (MSW or mocked hooks)

### 8. API communication
All API calls go through `/api/*` (same origin, nginx proxies to backend). No CORS needed.
Use TanStack Query for caching + invalidation. POST requests invalidate relevant queries.