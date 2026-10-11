import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ScraperService } from '../../src/services/ScraperService.js';
import { JsonProductRepository } from '../../src/repositories/ProductRepository.js';
import { JsonPriceHistoryRepository } from '../../src/repositories/PriceHistoryRepository.js';
import { JsonDisappearedRepository } from '../../src/repositories/DisappearedRepository.js';
import type { ShopifyProduct } from '../../src/types.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diafilm-scraper-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makeShopifyProduct(id: number, title: string, price: string = '1690'): ShopifyProduct {
  return {
    id,
    title,
    handle: title.toLowerCase().replace(/\s+/g, '-'),
    variants: [{ id: id * 10, price, compare_at_price: null, available: true }],
    images: [{ src: `https://cdn.shopify.com/${id}.jpg` }],
    tags: [],
    product_type: '',
    vendor: 'Diafilm',
    created_at: '2026-09-01T00:00:00+02:00',
    published_at: '2026-09-01T00:00:00+02:00',
  };
}

function mockFetch(pages: { products: ShopifyProduct[] }[]): (url: string) => Promise<Response> {
  let callCount = 0;
  return (url: string) => {
    const pageMatch = url.match(/page=(\d+)/);
    const page = pageMatch ? parseInt(pageMatch[1], 10) - 1 : 0;

    // Age group collection page requests — return empty HTML so no handles found
    if (url.includes('/collections/osszes-diafilm')) {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ products: [] }),
            headers: new Headers(),
            text: () => Promise.resolve('<html><body>No products</body></html>'),
          } as Response);
        }, 10);
      });
    }

    // Simulate delay
    return new Promise((resolve) => {
      setTimeout(() => {
        if (page < pages.length) {
          callCount++;
          resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(pages[page]),
            headers: new Headers(),
            text: () => Promise.resolve(JSON.stringify(pages[page])),
          } as Response);
        } else {
          // Empty page — end of pagination
          resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ products: [] }),
            headers: new Headers(),
            text: () => Promise.resolve('{"products":[]}'),
          } as Response);
        }
      }, 10); // 10ms instead of 500ms
    });
  };
}

describe('ScraperService', () => {
  it('scrapes all pages and returns sorted products', async () => {
    const productRepo = new JsonProductRepository(path.join(tmpDir, 'products.json'));
    const priceHistoryRepo = new JsonPriceHistoryRepository(path.join(tmpDir, 'price_history.json'));
    const disappearedRepo = new JsonDisappearedRepository(path.join(tmpDir, 'products_seen.json'));

    const fetchFn = mockFetch([
      { products: [makeShopifyProduct(3, 'Cékla'), makeShopifyProduct(1, 'Álma')] },
      { products: [makeShopifyProduct(2, 'Banán')] },
    ]);

    const scraper = new ScraperService(productRepo, priceHistoryRepo, disappearedRepo, fetchFn);
    const products = await scraper.scrapeAll();

    expect(products).toHaveLength(3);
    // Sorted by accent-insensitive title: Álma, Banán, Cékla
    expect(products[0].title).toBe('Álma');
    expect(products[1].title).toBe('Banán');
    expect(products[2].title).toBe('Cékla');
  });

  it('transforms Shopify product to Product format correctly', async () => {
    const productRepo = new JsonProductRepository(path.join(tmpDir, 'products.json'));
    const priceHistoryRepo = new JsonPriceHistoryRepository(path.join(tmpDir, 'price_history.json'));
    const disappearedRepo = new JsonDisappearedRepository(path.join(tmpDir, 'products_seen.json'));

    const shopifyProduct: ShopifyProduct = {
      id: 42,
      title: 'Test Product',
      handle: 'test-product',
      variants: [{ id: 420, price: '2500', compare_at_price: '3000', available: false }],
      images: [{ src: 'https://cdn.shopify.com/test.jpg' }],
      tags: 'tag1, tag2, tag3',
      product_type: 'film',
      vendor: 'TestVendor',
      created_at: '2026-09-01T00:00:00+02:00',
      published_at: '2026-09-01T00:00:00+02:00',
    };

    const fetchFn = mockFetch([{ products: [shopifyProduct] }]);
    const scraper = new ScraperService(productRepo, priceHistoryRepo, disappearedRepo, fetchFn);
    const products = await scraper.scrapeAll();

    expect(products[0]).toEqual({
      id: 42,
      title: 'Test Product',
      handle: 'test-product',
      url: 'https://diafilm.hu/products/test-product',
      variantId: 420,
      price: 2500,
      compareAtPrice: 3000,
      available: false,
      tags: ['tag1', 'tag2', 'tag3'],
      productType: 'film',
      vendor: 'TestVendor',
      imageUrl: 'https://cdn.shopify.com/test.jpg',
      createdAt: '2026-09-01T00:00:00+02:00',
      publishedAt: '2026-09-01T00:00:00+02:00',
      ageGroups: [],
    });
  });

  it('handles missing images gracefully', async () => {
    const productRepo = new JsonProductRepository(path.join(tmpDir, 'products.json'));
    const priceHistoryRepo = new JsonPriceHistoryRepository(path.join(tmpDir, 'price_history.json'));
    const disappearedRepo = new JsonDisappearedRepository(path.join(tmpDir, 'products_seen.json'));

    const shopifyProduct: ShopifyProduct = {
      id: 1,
      title: 'No Image',
      handle: 'no-image',
      variants: [{ id: 10, price: '100', compare_at_price: null, available: true }],
      images: [],
      tags: [],
      product_type: '',
      vendor: '',
      created_at: '2026-09-01T00:00:00+02:00',
      published_at: '2026-09-01T00:00:00+02:00',
    };

    const fetchFn = mockFetch([{ products: [shopifyProduct] }]);
    const scraper = new ScraperService(productRepo, priceHistoryRepo, disappearedRepo, fetchFn);
    const products = await scraper.scrapeAll();

    expect(products[0].imageUrl).toBeNull();
  });

  it('maybeRescrape scrapes when products.json is missing', async () => {
    const productRepo = new JsonProductRepository(path.join(tmpDir, 'products.json'));
    const priceHistoryRepo = new JsonPriceHistoryRepository(path.join(tmpDir, 'price_history.json'));
    const disappearedRepo = new JsonDisappearedRepository(path.join(tmpDir, 'products_seen.json'));

    const fetchFn = mockFetch([{ products: [makeShopifyProduct(1, 'Alma')] }]);
    const scraper = new ScraperService(productRepo, priceHistoryRepo, disappearedRepo, fetchFn);
    const result = await scraper.maybeRescrape();

    expect(result.scraped).toBe(true);
    expect(result.productCount).toBe(1);
    // First scrape does not log price history (no previous prices to compare)
    expect(result.priceChanges).toBe(0);
  });

  it('maybeRescrape does not scrape when products.json is fresh', async () => {
    const productRepo = new JsonProductRepository(path.join(tmpDir, 'products.json'));
    const priceHistoryRepo = new JsonPriceHistoryRepository(path.join(tmpDir, 'price_history.json'));
    const disappearedRepo = new JsonDisappearedRepository(path.join(tmpDir, 'products_seen.json'));

    // Pre-populate products.json
    await productRepo.saveAll([
      { id: 1, title: 'Existing', handle: 'existing', url: '', variantId: 10, price: 100, compareAtPrice: null, available: true, tags: [], productType: '', vendor: '', imageUrl: null, createdAt: '2026-09-01T00:00:00+02:00', publishedAt: '2026-09-01T00:00:00+02:00', ageGroups: [] },
    ]);

    const fetchFn = mockFetch([]);
    const scraper = new ScraperService(productRepo, priceHistoryRepo, disappearedRepo, fetchFn);
    const result = await scraper.maybeRescrape();

    expect(result.scraped).toBe(false);
    expect(result.productCount).toBe(1);
  });

  it('maybeRescrape re-scrapes when products.json is old', async () => {
    const productRepo = new JsonProductRepository(path.join(tmpDir, 'products.json'));
    const priceHistoryRepo = new JsonPriceHistoryRepository(path.join(tmpDir, 'price_history.json'));
    const disappearedRepo = new JsonDisappearedRepository(path.join(tmpDir, 'products_seen.json'));

    // Pre-populate with old data
    await productRepo.saveAll([
      { id: 1, title: 'Old', handle: 'old', url: '', variantId: 10, price: 100, compareAtPrice: null, available: true, tags: [], productType: '', vendor: '', imageUrl: null, createdAt: '2026-09-01T00:00:00+02:00', publishedAt: '2026-09-01T00:00:00+02:00', ageGroups: [] },
    ]);

    // Make the file old (backdate mtime)
    const filePath = path.join(tmpDir, 'products.json');
    const oldTime = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25h ago
    fs.utimesSync(filePath, oldTime, oldTime);

    const fetchFn = mockFetch([{ products: [makeShopifyProduct(1, 'New', '200')] }]);
    const scraper = new ScraperService(productRepo, priceHistoryRepo, disappearedRepo, fetchFn);
    const result = await scraper.maybeRescrape();

    expect(result.scraped).toBe(true);
    expect(result.productCount).toBe(1);
    // Price changed from 100 to 200
    expect(result.priceChanges).toBe(1);
  });

  it('updatePriceHistory logs price changes', async () => {
    const productRepo = new JsonProductRepository(path.join(tmpDir, 'products.json'));
    const priceHistoryRepo = new JsonPriceHistoryRepository(path.join(tmpDir, 'price_history.json'));
    const disappearedRepo = new JsonDisappearedRepository(path.join(tmpDir, 'products_seen.json'));

    const scraper = new ScraperService(productRepo, priceHistoryRepo, disappearedRepo, mockFetch([]));

    const oldProducts = [
      { id: 1, title: 'A', handle: 'a', url: '', variantId: 10, price: 100, compareAtPrice: null, available: true, tags: [], productType: '', vendor: '', imageUrl: null, createdAt: '2026-09-01T00:00:00+02:00', publishedAt: '2026-09-01T00:00:00+02:00', ageGroups: [] },
    ];
    const newProducts = [
      { id: 1, title: 'A', handle: 'a', url: '', variantId: 10, price: 150, compareAtPrice: null, available: true, tags: [], productType: '', vendor: '', imageUrl: null, createdAt: '2026-09-01T00:00:00+02:00', publishedAt: '2026-09-01T00:00:00+02:00', ageGroups: [] },
    ];

    const changes = await scraper.updatePriceHistory(oldProducts, newProducts);
    expect(changes).toBe(1);

    const history = await priceHistoryRepo.getAll();
    expect(history).toHaveLength(1);
    expect(history[0].price).toBe(150);
  });

  it('updatePriceHistory does not log when price unchanged', async () => {
    const productRepo = new JsonProductRepository(path.join(tmpDir, 'products.json'));
    const priceHistoryRepo = new JsonPriceHistoryRepository(path.join(tmpDir, 'price_history.json'));
    const disappearedRepo = new JsonDisappearedRepository(path.join(tmpDir, 'products_seen.json'));

    const scraper = new ScraperService(productRepo, priceHistoryRepo, disappearedRepo, mockFetch([]));

    const oldProducts = [
      { id: 1, title: 'A', handle: 'a', url: '', variantId: 10, price: 100, compareAtPrice: null, available: true, tags: [], productType: '', vendor: '', imageUrl: null, createdAt: '2026-09-01T00:00:00+02:00', publishedAt: '2026-09-01T00:00:00+02:00', ageGroups: [] },
    ];
    const newProducts = [
      { id: 1, title: 'A', handle: 'a', url: '', variantId: 10, price: 100, compareAtPrice: null, available: true, tags: [], productType: '', vendor: '', imageUrl: null, createdAt: '2026-09-01T00:00:00+02:00', publishedAt: '2026-09-01T00:00:00+02:00', ageGroups: [] },
    ];

    const changes = await scraper.updatePriceHistory(oldProducts, newProducts);
    expect(changes).toBe(0);
  });

  it('updatePriceHistory does not log new products (not price changes)', async () => {
    const productRepo = new JsonProductRepository(path.join(tmpDir, 'products.json'));
    const priceHistoryRepo = new JsonPriceHistoryRepository(path.join(tmpDir, 'price_history.json'));
    const disappearedRepo = new JsonDisappearedRepository(path.join(tmpDir, 'products_seen.json'));

    const scraper = new ScraperService(productRepo, priceHistoryRepo, disappearedRepo, mockFetch([]));

    // Old scrape has 1 product, new scrape has the same product + 1 new product
    const oldProducts = [
      { id: 1, title: 'A', handle: 'a', url: '', variantId: 10, price: 100, compareAtPrice: null, available: true, tags: [], productType: '', vendor: '', imageUrl: null, createdAt: '2026-09-01T00:00:00+02:00', publishedAt: '2026-09-01T00:00:00+02:00', ageGroups: [] },
    ];
    const newProducts = [
      { id: 1, title: 'A', handle: 'a', url: '', variantId: 10, price: 100, compareAtPrice: null, available: true, tags: [], productType: '', vendor: '', imageUrl: null, createdAt: '2026-09-01T00:00:00+02:00', publishedAt: '2026-09-01T00:00:00+02:00', ageGroups: [] },
      { id: 2, title: 'B (new)', handle: 'b', url: '', variantId: 20, price: 200, compareAtPrice: null, available: true, tags: [], productType: '', vendor: '', imageUrl: null, createdAt: '2026-09-01T00:00:00+02:00', publishedAt: '2026-09-01T00:00:00+02:00', ageGroups: [] },
    ];

    const changes = await scraper.updatePriceHistory(oldProducts, newProducts);
    expect(changes).toBe(0);

    const history = await priceHistoryRepo.getAll();
    expect(history).toHaveLength(0);
  });

  it('checkDisappeared logs products gone from scrape', async () => {
    const productRepo = new JsonProductRepository(path.join(tmpDir, 'products.json'));
    const priceHistoryRepo = new JsonPriceHistoryRepository(path.join(tmpDir, 'price_history.json'));
    const disappearedRepo = new JsonDisappearedRepository(path.join(tmpDir, 'products_seen.json'));

    const scraper = new ScraperService(productRepo, priceHistoryRepo, disappearedRepo, mockFetch([]));

    const oldProducts = [
      { id: 1, title: 'A', handle: 'a', url: '', variantId: 10, price: 100, compareAtPrice: null, available: true, tags: [], productType: '', vendor: '', imageUrl: null, createdAt: '2026-09-01T00:00:00+02:00', publishedAt: '2026-09-01T00:00:00+02:00', ageGroups: [] },
      { id: 2, title: 'B', handle: 'b', url: '', variantId: 20, price: 200, compareAtPrice: null, available: true, tags: [], productType: '', vendor: '', imageUrl: null, createdAt: '2026-09-01T00:00:00+02:00', publishedAt: '2026-09-01T00:00:00+02:00', ageGroups: [] },
    ];
    const newProducts = [
      { id: 1, title: 'A', handle: 'a', url: '', variantId: 10, price: 100, compareAtPrice: null, available: true, tags: [], productType: '', vendor: '', imageUrl: null, createdAt: '2026-09-01T00:00:00+02:00', publishedAt: '2026-09-01T00:00:00+02:00', ageGroups: [] },
      // Product 2 disappeared
    ];

    const gone = await scraper.checkDisappeared(oldProducts, newProducts);
    expect(gone).toBe(1);

    const disappeared = await disappearedRepo.getAll();
    expect(disappeared).toHaveLength(1);
    expect(disappeared[0].id).toBe(2);
    expect(disappeared[0].title).toBe('B');
  });

  it('checkDisappeared does not log already-disappeared products', async () => {
    const productRepo = new JsonProductRepository(path.join(tmpDir, 'products.json'));
    const priceHistoryRepo = new JsonPriceHistoryRepository(path.join(tmpDir, 'price_history.json'));
    const disappearedRepo = new JsonDisappearedRepository(path.join(tmpDir, 'products_seen.json'));

    // Pre-populate disappeared with product 2
    await disappearedRepo.saveAll([
      { id: 2, title: 'B', lastPrice: 200, lastSeen: '2024-01-01', disappearedOn: '2024-01-01' },
    ]);

    const scraper = new ScraperService(productRepo, priceHistoryRepo, disappearedRepo, mockFetch([]));

    const oldProducts = [
      { id: 1, title: 'A', handle: 'a', url: '', variantId: 10, price: 100, compareAtPrice: null, available: true, tags: [], productType: '', vendor: '', imageUrl: null, createdAt: '2026-09-01T00:00:00+02:00', publishedAt: '2026-09-01T00:00:00+02:00', ageGroups: [] },
      { id: 2, title: 'B', handle: 'b', url: '', variantId: 20, price: 200, compareAtPrice: null, available: true, tags: [], productType: '', vendor: '', imageUrl: null, createdAt: '2026-09-01T00:00:00+02:00', publishedAt: '2026-09-01T00:00:00+02:00', ageGroups: [] },
    ];
    const newProducts = [oldProducts[0]];

    const gone = await scraper.checkDisappeared(oldProducts, newProducts);
    expect(gone).toBe(0); // Already logged
  });

  it('scrapeAgeGroups extracts handles from collection page HTML', async () => {
    const productRepo = new JsonProductRepository(path.join(tmpDir, 'products.json'));
    const priceHistoryRepo = new JsonPriceHistoryRepository(path.join(tmpDir, 'price_history.json'));
    const disappearedRepo = new JsonDisappearedRepository(path.join(tmpDir, 'products_seen.json'));

    // Mock fetch that returns HTML with product links for age group pages
    const ageFetchFn = (url: string): Promise<Response> => {
      if (url.includes('/collections/osszes-diafilm')) {
        // Page 1 returns handles, page 2 returns empty (no new handles)
        const pageMatch = url.match(/page=(\d+)/);
        const page = pageMatch ? parseInt(pageMatch[1], 10) : 1;

        let html = '';
        if (page === 1) {
          // Determine which age group from the URL
          if (url.includes('2+%C3%A9ves+kort%C3%B3l') || url.includes('2%20%C3%A9ves')) {
            html = '<a href="/products/alpha">A</a><a href="/products/beta">B</a>';
          } else if (url.includes('4+%C3%A9ves+kort%C3%B3l') || url.includes('4%20%C3%A9ves')) {
            html = '<a href="/products/beta">B</a><a href="/products/gamma">G</a>';
          } else {
            html = '<a href="/products/alpha">A</a>';
          }
        } else {
          // Page 2: empty, no new handles
          html = '<html><body>Empty</body></html>';
        }

        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: () => Promise.resolve({ products: [] }),
          text: () => Promise.resolve(html),
        } as Response);
      }
      // Non-collection URLs
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () => Promise.resolve({ products: [] }),
        text: () => Promise.resolve('{}'),
      } as Response);
    };

    const scraper = new ScraperService(productRepo, priceHistoryRepo, disappearedRepo, ageFetchFn);
    const ageMap = await scraper.scrapeAgeGroups();

    // alpha should be in 2é and 6é, beta in 2é and 4é, gamma in 4é
    expect(ageMap.get('alpha')).toEqual(expect.arrayContaining(['2 éves kortól', '6 éves kortól']));
    expect(ageMap.get('beta')).toEqual(expect.arrayContaining(['2 éves kortól', '4 éves kortól']));
    expect(ageMap.get('gamma')).toEqual(['4 éves kortól']);
  });

  it('scrapeAll merges age groups into products', async () => {
    const productRepo = new JsonProductRepository(path.join(tmpDir, 'products.json'));
    const priceHistoryRepo = new JsonPriceHistoryRepository(path.join(tmpDir, 'price_history.json'));
    const disappearedRepo = new JsonDisappearedRepository(path.join(tmpDir, 'products_seen.json'));

    // Mock fetch: products.json returns 1 product, collection pages return handles
    const mergeFetchFn = (url: string): Promise<Response> => {
      if (url.includes('/collections/osszes-diafilm')) {
        const pageMatch = url.match(/page=(\d+)/);
        const page = pageMatch ? parseInt(pageMatch[1], 10) : 1;
        let html = '';
        if (page === 1) {
          if (url.includes('2+%C3%A9ves+kort%C3%B3l') || url.includes('2%20%C3%A9ves')) {
            html = '<a href="/products/alma">Alma</a>';
          } else {
            html = '<html><body>Empty</body></html>';
          }
        } else {
          html = '<html><body>Empty</body></html>';
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: () => Promise.resolve({ products: [] }),
          text: () => Promise.resolve(html),
        } as Response);
      }
      // products.json
      const pageMatch = url.match(/page=(\d+)/);
      const page = pageMatch ? parseInt(pageMatch[1], 10) - 1 : 0;
      if (page === 0) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: () => Promise.resolve({ products: [makeShopifyProduct(1, 'Alma')] }),
          text: () => Promise.resolve('{}'),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () => Promise.resolve({ products: [] }),
        text: () => Promise.resolve('{}'),
      } as Response);
    };

    const scraper = new ScraperService(productRepo, priceHistoryRepo, disappearedRepo, mergeFetchFn);
    const products = await scraper.scrapeAll();

    expect(products).toHaveLength(1);
    expect(products[0].handle).toBe('alma');
    expect(products[0].ageGroups).toEqual(['2 éves kortól']);
  });
});