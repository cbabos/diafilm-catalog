// ── Core domain types (from API_SPEC.md) ──────────────────────────

export interface Product {
  id: number;
  title: string;
  handle: string;
  url: string;
  variantId: number;
  price: number; // HUF
  compareAtPrice: number | null; // original price if on sale
  available: boolean;
  tags: string[];
  productType: string;
  vendor: string;
  imageUrl: string | null;
}

export interface BoughtItem {
  id: number; // product ID
  boughtAt: string; // ISO timestamp
  product: Product; // full snapshot at time of purchase
}

export interface PriceHistoryEntry {
  id: number;
  title: string;
  price: number;
  compareAtPrice: number | null;
  date: string; // YYYY-MM-DD
}

export interface DisappearedProduct {
  id: number;
  title: string;
  lastPrice: number;
  lastSeen: string;
  disappearedOn: string;
}

export interface OrderResponse {
  ok: boolean;
  cartToken: string;
  checkoutUrl: string;
  itemCount: number;
  totalPrice: number; // in fillér (Shopify format, divide by 100 for HUF)
}

export interface OrderRequest {
  variantIds: number[];
}

// ── UI types ──────────────────────────────────────────────────────

export type FilterType = 'all' | 'sale' | 'selected' | 'bought';

export type ModalType = 'order' | 'removeBought' | 'priceHistory' | null;

/** Product with a discontinued flag (not in current scrape but in bought) */
export interface RenderProduct extends Product {
  _discontinued?: boolean;
}

export interface BoughtInfo {
  pricePaid: number;
  date: string;
}