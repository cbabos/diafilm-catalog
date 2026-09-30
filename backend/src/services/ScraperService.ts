import type {
  Product,
  PriceHistoryEntry,
  DisappearedProduct,
  ShopifyProduct,
} from '../types.js';
import type { IProductRepository } from '../repositories/ProductRepository.js';
import type { IPriceHistoryRepository } from '../repositories/PriceHistoryRepository.js';
import type { IDisappearedRepository } from '../repositories/DisappearedRepository.js';
import { sortByTitle } from '../utils/normalize.js';
import { config } from '../config.js';

export interface ScraperFetchFn {
  (url: string, init?: RequestInit): Promise<Response>;
}

export class ScraperService {
  private fetchFn: ScraperFetchFn;

  constructor(
    private productRepo: IProductRepository,
    private priceHistoryRepo: IPriceHistoryRepository,
    private disappearedRepo: IDisappearedRepository,
    fetchFn?: ScraperFetchFn,
  ) {
    this.fetchFn = fetchFn ?? ((url: string, init?: RequestInit) => fetch(url, init));
  }

  /**
   * Scrape all products from diafilm.hu via Shopify products.json API.
   * Paginates until empty response. Sorts with Hungarian accent-insensitive normalization.
   */
  async scrapeAll(): Promise<Product[]> {
    const allProducts: Product[] = [];
    const seenIds = new Set<number>();
    let page = 1;

    while (true) {
      const url = `${config.shopifyBase}/products.json?limit=250&page=${page}`;
      const resp = await this.fetchFn(url, {
        headers: {
          'User-Agent': config.userAgent,
          Accept: 'application/json',
        },
      });

      if (!resp.ok) {
        throw new Error(`Scrape error page ${page}: HTTP ${resp.status}`);
      }

      const data = (await resp.json()) as { products: ShopifyProduct[] };
      const products = data.products;
      if (!products || products.length === 0) break;

      for (const p of products) {
        if (seenIds.has(p.id)) continue;
        seenIds.add(p.id);

        const variant = p.variants?.[0] ?? { id: 0, price: '0', compare_at_price: null, available: true };
        const images = p.images ?? [];
        const priceStr = variant.price ?? '0';
        const price = parseFloat(priceStr) || 0;
        const compareAtPrice = variant.compare_at_price ? parseFloat(variant.compare_at_price) : null;
        const tags = Array.isArray(p.tags) ? p.tags : (p.tags ? p.tags.split(',').map((t) => t.trim()).filter(Boolean) : []);

        allProducts.push({
          id: p.id,
          title: p.title,
          handle: p.handle,
          url: `${config.shopifyBase}/products/${p.handle}`,
          variantId: variant.id,
          price,
          compareAtPrice,
          available: variant.available ?? true,
          tags,
          productType: p.product_type ?? '',
          vendor: p.vendor ?? '',
          imageUrl: images[0]?.src ?? null,
        });
      }

      page++;
      // Small delay to be polite
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Sort by Hungarian accent-insensitive title
    return sortByTitle(allProducts, (p) => p.title);
  }

  /**
   * Check if products.json is missing or older than 24h, and re-scrape if needed.
   * After re-scrape: diff prices → append to price_history, check disappeared.
   */
  async maybeRescrape(): Promise<{ scraped: boolean; productCount: number; priceChanges: number; disappearedCount: number }> {
    const mtime = await this.productRepo.getFileMtime();
    const now = Date.now();
    const result = { scraped: false, productCount: 0, priceChanges: 0, disappearedCount: 0 };

    if (mtime === null) {
      // No products.json — first scrape
      const products = await this.scrapeAll();
      await this.productRepo.saveAll(products);
      result.scraped = true;
      result.productCount = products.length;
      // Log all as initial price history
      const priceChanges = await this.updatePriceHistory([], products);
      result.priceChanges = priceChanges;
      return result;
    }

    const ageSeconds = (now - mtime) / 1000;
    if (ageSeconds > config.rescrapeMaxAgeSeconds) {
      const oldProducts = await this.productRepo.getAll();
      const newProducts = await this.scrapeAll();
      await this.productRepo.saveAll(newProducts);
      result.scraped = true;
      result.productCount = newProducts.length;
      result.priceChanges = await this.updatePriceHistory(oldProducts, newProducts);
      result.disappearedCount = await this.checkDisappeared(oldProducts, newProducts);
      return result;
    }

    // Fresh enough — just report current count
    const current = await this.productRepo.getAll();
    result.productCount = current.length;
    return result;
  }

  /**
   * Compare prices, append entries only for changed products.
   * Matches the Python logic: uses last history entry or old scrape as reference.
   */
  async updatePriceHistory(oldProducts: Product[], newProducts: Product[]): Promise<number> {
    const history = await this.priceHistoryRepo.getAll();
    const today = new Date().toISOString().slice(0, 10);

    const oldMap = new Map(oldProducts.map((p) => [p.id, p]));
    const newMap = new Map(newProducts.map((p) => [p.id, p]));

    // Build a quick lookup of the last entry per product
    const lastEntries = new Map<number, PriceHistoryEntry>();
    for (const entry of history) {
      lastEntries.set(entry.id, entry);
    }

    let changes = 0;
    for (const [pid, newP] of newMap) {
      const oldP = oldMap.get(pid);
      const last = lastEntries.get(pid);

      let refPrice: number | null = null;
      let refCompare: number | null = null;

      if (last) {
        refPrice = last.price;
        refCompare = last.compareAtPrice;
      } else if (oldP) {
        refPrice = oldP.price;
        refCompare = oldP.compareAtPrice;
      }

      if (refPrice === null) {
        // First time seeing this product — log it
        history.push({
          id: pid,
          title: newP.title,
          price: newP.price,
          compareAtPrice: newP.compareAtPrice,
          date: today,
        });
        changes++;
      } else if (refPrice !== newP.price || refCompare !== newP.compareAtPrice) {
        history.push({
          id: pid,
          title: newP.title,
          price: newP.price,
          compareAtPrice: newP.compareAtPrice,
          date: today,
        });
        changes++;
      }
    }

    if (changes > 0) {
      await this.priceHistoryRepo.saveAll(history);
    }

    return changes;
  }

  /**
   * Log products that were in old scrape but not in new scrape.
   */
  async checkDisappeared(oldProducts: Product[], newProducts: Product[]): Promise<number> {
    const disappeared = await this.disappearedRepo.getAll();
    const disIds = new Set(disappeared.map((d) => d.id));

    const oldIds = new Set(oldProducts.map((p) => p.id));
    const newIds = new Set(newProducts.map((p) => p.id));
    const gone = [...oldIds].filter((id) => !newIds.has(id));

    const today = new Date().toISOString().slice(0, 10);
    let newCount = 0;

    for (const p of oldProducts) {
      if (gone.includes(p.id) && !disIds.has(p.id)) {
        const entry: DisappearedProduct = {
          id: p.id,
          title: p.title,
          lastPrice: p.price,
          lastSeen: today,
          disappearedOn: today,
        };
        disappeared.push(entry);
        newCount++;
      }
    }

    if (newCount > 0) {
      await this.disappearedRepo.saveAll(disappeared);
    }

    return newCount;
  }
}