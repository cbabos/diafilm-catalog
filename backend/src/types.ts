// Shared TypeScript types for the diafilm backend

export interface Product {
  id: number;
  title: string;
  handle: string;
  url: string;
  variantId: number;
  price: number; // HUF, e.g. 1690
  compareAtPrice: number | null; // original price if on sale, null otherwise
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
  lastSeen: string; // YYYY-MM-DD
  disappearedOn: string; // YYYY-MM-DD
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

export interface HealthResponse {
  status: string;
  products: number;
  uptime: number;
}

// Legacy bare-ID format (numbers) — pre-migration
export type LegacyBoughtItem = number;

// Raw Shopify product from products.json API
export interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  variants: ShopifyVariant[];
  images: { src: string }[];
  tags: string | string[];
  product_type: string;
  vendor: string;
}

export interface ShopifyVariant {
  id: number;
  price: string;
  compare_at_price: string | null;
  available: boolean;
}