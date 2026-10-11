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
          createdAt: p.created_at ?? '',
          publishedAt: p.published_at ?? '',
          ageGroups: [],
        });
      }

      page++;
      // Small delay to be polite
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Enrich with age group data from collection page faceted filters
    console.log('🔄 Enriching with age group data...');
    try {
      const ageMap = await this.scrapeAgeGroups();
      console.log(`   Age map: ${ageMap.size} handles with age data`);
      let enriched = 0;
      for (const product of allProducts) {
        const ages = ageMap.get(product.handle);
        if (ages && ages.length > 0) {
          product.ageGroups = ages;
          enriched++;
        }
      }
      console.log(`   Enriched ${enriched}/${allProducts.length} products with age groups`);
    } catch (err) {
      console.error(`   ⚠️ Age enrichment failed: ${err}`);
    }

    // Sort by Hungarian accent-insensitive title
    return sortByTitle(allProducts, (p) => p.title);
  }

  /**
   * Scrape age group (korosztály) data from collection page faceted filters.
   * The age recommendation is stored in a custom metafield `korosztaly_szerint`
   * that is NOT available via the products.json API — only via the collection
   * page filter URLs.
   *
   * For each age group, paginates through the filtered collection pages,
   * extracting product handles via regex. Builds a Map<handle, ageGroups[]>.
   *
   * Sleeps 1 second between each HTTP request to avoid 429 rate limit.
   */
  async scrapeAgeGroups(): Promise<Map<string, string[]>> {
    const ageMap = new Map<string, string[]>();

    for (const age of config.ageGroups) {
      const encodedAge = encodeURIComponent(age);
      let page = 1;
      let totalForAge = 0;

      while (true) {
        const url = `${config.shopifyBase}/collections/osszes-diafilm?sort_by=title-ascending&page=${page}&filter.p.m.custom.korosztaly_szerint=${encodedAge}`;

        const resp = await this.fetchFn(url, {
          headers: {
            'User-Agent': config.userAgent,
            Accept: 'text/html,application/xhtml+xml',
          },
        });

        if (!resp.ok) {
          throw new Error(`Age group scrape error (age=${age}, page=${page}): HTTP ${resp.status}`);
        }

        const html = await resp.text();

        // Extract product handles from the HTML
        // Use [^"]+ to capture full URL including query params, then split on '?'
        const handleRegex = /href="\/products\/([^"]+)"/g;
        let newHandlesFound = 0;
        let match: RegExpExecArray | null;

        while ((match = handleRegex.exec(html)) !== null) {
          const handle = match[1].split('?')[0]; // strip query params
          if (!ageMap.has(handle)) {
            ageMap.set(handle, []);
          }
          const ages = ageMap.get(handle)!;
          if (!ages.includes(age)) {
            ages.push(age);
            newHandlesFound++;
          }
        }

        // Stop when no new handles are found on this page
        if (newHandlesFound === 0) {
          break;
        }

        totalForAge += newHandlesFound;
        page++;

        // Sleep 1 second between each HTTP request to avoid 429
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      console.log(`   Age "${age}": ${totalForAge} handles`);
    }

    return ageMap;
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
      // First scrape — no price history to build (no previous prices to compare)
      result.priceChanges = 0;
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
        // New product — not in old scrape, not in price history.
        // This is a new arrival, not a price change. Skip it.
        continue;
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