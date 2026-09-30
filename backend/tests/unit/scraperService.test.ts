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
  };
}

function mockFetch(pages: { products: ShopifyProduct[] }[]): (url: string) => Promise<Response> {
  let callCount = 0;
  return (url: string) => {
    const pageMatch = url.match(/page=(\d+)/);
    const page = pageMatch ? parseInt(pageMatch[1], 10) - 1 : 0;

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
    // First scrape logs all as initial price history
    expect(result.priceChanges).toBe(1);
  });

  it('maybeRescrape does not scrape when products.json is fresh', async () => {
    const productRepo = new JsonProductRepository(path.join(tmpDir, 'products.json'));
    const priceHistoryRepo = new JsonPriceHistoryRepository(path.join(tmpDir, 'price_history.json'));
    const disappearedRepo = new JsonDisappearedRepository(path.join(tmpDir, 'products_seen.json'));

    // Pre-populate products.json
    await productRepo.saveAll([
      { id: 1, title: 'Existing', handle: 'existing', url: '', variantId: 10, price: 100, compareAtPrice: null, available: true, tags: [], productType: '', vendor: '', imageUrl: null },
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
      { id: 1, title: 'Old', handle: 'old', url: '', variantId: 10, price: 100, compareAtPrice: null, available: true, tags: [], productType: '', vendor: '', imageUrl: null },
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
      { id: 1, title: 'A', handle: 'a', url: '', variantId: 10, price: 100, compareAtPrice: null, available: true, tags: [], productType: '', vendor: '', imageUrl: null },
    ];
    const newProducts = [
      { id: 1, title: 'A', handle: 'a', url: '', variantId: 10, price: 150, compareAtPrice: null, available: true, tags: [], productType: '', vendor: '', imageUrl: null },
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
      { id: 1, title: 'A', handle: 'a', url: '', variantId: 10, price: 100, compareAtPrice: null, available: true, tags: [], productType: '', vendor: '', imageUrl: null },
    ];
    const newProducts = [
      { id: 1, title: 'A', handle: 'a', url: '', variantId: 10, price: 100, compareAtPrice: null, available: true, tags: [], productType: '', vendor: '', imageUrl: null },
    ];

    const changes = await scraper.updatePriceHistory(oldProducts, newProducts);
    expect(changes).toBe(0);
  });

  it('checkDisappeared logs products gone from scrape', async () => {
    const productRepo = new JsonProductRepository(path.join(tmpDir, 'products.json'));
    const priceHistoryRepo = new JsonPriceHistoryRepository(path.join(tmpDir, 'price_history.json'));
    const disappearedRepo = new JsonDisappearedRepository(path.join(tmpDir, 'products_seen.json'));

    const scraper = new ScraperService(productRepo, priceHistoryRepo, disappearedRepo, mockFetch([]));

    const oldProducts = [
      { id: 1, title: 'A', handle: 'a', url: '', variantId: 10, price: 100, compareAtPrice: null, available: true, tags: [], productType: '', vendor: '', imageUrl: null },
      { id: 2, title: 'B', handle: 'b', url: '', variantId: 20, price: 200, compareAtPrice: null, available: true, tags: [], productType: '', vendor: '', imageUrl: null },
    ];
    const newProducts = [
      { id: 1, title: 'A', handle: 'a', url: '', variantId: 10, price: 100, compareAtPrice: null, available: true, tags: [], productType: '', vendor: '', imageUrl: null },
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
      { id: 1, title: 'A', handle: 'a', url: '', variantId: 10, price: 100, compareAtPrice: null, available: true, tags: [], productType: '', vendor: '', imageUrl: null },
      { id: 2, title: 'B', handle: 'b', url: '', variantId: 20, price: 200, compareAtPrice: null, available: true, tags: [], productType: '', vendor: '', imageUrl: null },
    ];
    const newProducts = [oldProducts[0]];

    const gone = await scraper.checkDisappeared(oldProducts, newProducts);
    expect(gone).toBe(0); // Already logged
  });
});