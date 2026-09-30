import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { JsonProductRepository } from '../../src/repositories/ProductRepository.js';
import { JsonBoughtRepository } from '../../src/repositories/BoughtRepository.js';
import { JsonSelectionRepository } from '../../src/repositories/SelectionRepository.js';
import { JsonPriceHistoryRepository } from '../../src/repositories/PriceHistoryRepository.js';
import { JsonDisappearedRepository } from '../../src/repositories/DisappearedRepository.js';
import type { Product, BoughtItem, PriceHistoryEntry, DisappearedProduct } from '../../src/types.js';

let tmpDir: string;

function tmpFile(name: string): string {
  return path.join(tmpDir, name);
}

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 1,
    title: 'Test Product',
    handle: 'test-product',
    url: 'https://diafilm.hu/products/test-product',
    variantId: 100,
    price: 1690,
    compareAtPrice: null,
    available: true,
    tags: ['test'],
    productType: '',
    vendor: 'Diafilm',
    imageUrl: null,
    ...overrides,
  };
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diafilm-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('JsonProductRepository', () => {
  it('returns empty array when file does not exist', async () => {
    const repo = new JsonProductRepository(tmpFile('products.json'));
    expect(await repo.getAll()).toEqual([]);
  });

  it('saves and retrieves products', async () => {
    const repo = new JsonProductRepository(tmpFile('products.json'));
    const products = [makeProduct({ id: 1, title: 'Apple' }), makeProduct({ id: 2, title: 'Banana' })];
    await repo.saveAll(products);
    const result = await repo.getAll();
    expect(result).toHaveLength(2);
    // Products are sorted by title on save
    expect(result.find((p) => p.id === 1)).toBeDefined();
    expect(result.find((p) => p.id === 2)).toBeDefined();
  });

  it('sorts products by Hungarian accent-insensitive title on save', async () => {
    const repo = new JsonProductRepository(tmpFile('products.json'));
    const products = [
      makeProduct({ id: 1, title: 'Árvíztűrő' }),
      makeProduct({ id: 2, title: 'Alma' }),
      makeProduct({ id: 3, title: 'Éva' }),
    ];
    await repo.saveAll(products);
    const result = await repo.getAll();
    // After accent-insensitive sort: Alma, Árvíztűrő, Éva → alma, arvizturo, eva
    expect(result[0].title).toBe('Alma');
    expect(result[1].title).toBe('Árvíztűrő');
    expect(result[2].title).toBe('Éva');
  });

  it('gets product by id', async () => {
    const repo = new JsonProductRepository(tmpFile('products.json'));
    await repo.saveAll([makeProduct({ id: 42 }), makeProduct({ id: 99 })]);
    const found = await repo.getById(42);
    expect(found?.id).toBe(42);
    const notFound = await repo.getById(999);
    expect(notFound).toBeNull();
  });

  it('returns null mtime when file does not exist', async () => {
    const repo = new JsonProductRepository(tmpFile('products.json'));
    expect(await repo.getFileMtime()).toBeNull();
  });

  it('returns mtime when file exists', async () => {
    const repo = new JsonProductRepository(tmpFile('products.json'));
    await repo.saveAll([makeProduct()]);
    const mtime = await repo.getFileMtime();
    expect(mtime).not.toBeNull();
    expect(mtime!).toBeGreaterThan(0);
  });

  it('ensures file exists', () => {
    const repo = new JsonProductRepository(tmpFile('products.json'));
    repo.ensureFile();
    expect(fs.existsSync(tmpFile('products.json'))).toBe(true);
  });
});

describe('JsonBoughtRepository', () => {
  it('returns empty array when file does not exist', async () => {
    const repo = new JsonBoughtRepository(tmpFile('bought.json'));
    expect(await repo.getAll()).toEqual([]);
  });

  it('saves and retrieves bought items', async () => {
    const repo = new JsonBoughtRepository(tmpFile('bought.json'));
    const items: BoughtItem[] = [
      { id: 1, boughtAt: '2024-01-01T00:00:00Z', product: makeProduct({ id: 1 }) },
    ];
    await repo.saveAll(items);
    expect(await repo.getAll()).toEqual(items);
  });

  it('adds item and removes duplicates by id', async () => {
    const repo = new JsonBoughtRepository(tmpFile('bought.json'));
    await repo.saveAll([
      { id: 1, boughtAt: '2024-01-01T00:00:00Z', product: makeProduct({ id: 1 }) },
    ]);
    await repo.add({ id: 1, boughtAt: '2024-02-01T00:00:00Z', product: makeProduct({ id: 1 }) });
    const result = await repo.getAll();
    expect(result).toHaveLength(1);
    expect(result[0].boughtAt).toBe('2024-02-01T00:00:00Z');
  });

  it('removes item by id', async () => {
    const repo = new JsonBoughtRepository(tmpFile('bought.json'));
    await repo.saveAll([
      { id: 1, boughtAt: '2024-01-01T00:00:00Z', product: makeProduct({ id: 1 }) },
      { id: 2, boughtAt: '2024-01-02T00:00:00Z', product: makeProduct({ id: 2 }) },
    ]);
    await repo.remove(1);
    const result = await repo.getAll();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  it('detects legacy bare-ID format', async () => {
    const repo = new JsonBoughtRepository(tmpFile('bought.json'));
    // Write bare IDs directly
    fs.writeFileSync(tmpFile('bought.json'), JSON.stringify([1, 2, 3]));
    expect(await repo.isLegacyFormat()).toBe(true);
  });

  it('detects enriched format (not legacy)', async () => {
    const repo = new JsonBoughtRepository(tmpFile('bought.json'));
    await repo.saveAll([
      { id: 1, boughtAt: '2024-01-01T00:00:00Z', product: makeProduct({ id: 1 }) },
    ]);
    expect(await repo.isLegacyFormat()).toBe(false);
  });

  it('returns false for legacy check on empty array', async () => {
    const repo = new JsonBoughtRepository(tmpFile('bought.json'));
    expect(await repo.isLegacyFormat()).toBe(false);
  });
});

describe('JsonSelectionRepository', () => {
  it('returns empty array when file does not exist', async () => {
    const repo = new JsonSelectionRepository(tmpFile('selected.json'));
    expect(await repo.getAll()).toEqual([]);
  });

  it('saves and retrieves selection', async () => {
    const repo = new JsonSelectionRepository(tmpFile('selected.json'));
    await repo.saveAll([1, 2, 3]);
    expect(await repo.getAll()).toEqual([1, 2, 3]);
  });

  it('deduplicates on save', async () => {
    const repo = new JsonSelectionRepository(tmpFile('selected.json'));
    await repo.saveAll([1, 1, 2, 2, 3]);
    expect(await repo.getAll()).toEqual([1, 2, 3]);
  });

  it('adds id', async () => {
    const repo = new JsonSelectionRepository(tmpFile('selected.json'));
    await repo.saveAll([1]);
    await repo.add(2);
    expect(await repo.getAll()).toEqual([1, 2]);
  });

  it('does not add duplicate', async () => {
    const repo = new JsonSelectionRepository(tmpFile('selected.json'));
    await repo.saveAll([1]);
    await repo.add(1);
    expect(await repo.getAll()).toEqual([1]);
  });

  it('removes id', async () => {
    const repo = new JsonSelectionRepository(tmpFile('selected.json'));
    await repo.saveAll([1, 2, 3]);
    await repo.remove(2);
    expect(await repo.getAll()).toEqual([1, 3]);
  });

  it('toggles id on', async () => {
    const repo = new JsonSelectionRepository(tmpFile('selected.json'));
    await repo.saveAll([1]);
    await repo.toggle(2);
    expect(await repo.getAll()).toEqual([1, 2]);
  });

  it('toggles id off', async () => {
    const repo = new JsonSelectionRepository(tmpFile('selected.json'));
    await repo.saveAll([1, 2]);
    await repo.toggle(1);
    expect(await repo.getAll()).toEqual([2]);
  });
});

describe('JsonPriceHistoryRepository', () => {
  it('returns empty array when file does not exist', async () => {
    const repo = new JsonPriceHistoryRepository(tmpFile('price_history.json'));
    expect(await repo.getAll()).toEqual([]);
  });

  it('saves and retrieves entries', async () => {
    const repo = new JsonPriceHistoryRepository(tmpFile('price_history.json'));
    const entries: PriceHistoryEntry[] = [
      { id: 1, title: 'Test', price: 1690, compareAtPrice: null, date: '2024-01-01' },
    ];
    await repo.saveAll(entries);
    expect(await repo.getAll()).toEqual(entries);
  });

  it('gets entries by product id', async () => {
    const repo = new JsonPriceHistoryRepository(tmpFile('price_history.json'));
    await repo.saveAll([
      { id: 1, title: 'A', price: 100, compareAtPrice: null, date: '2024-01-01' },
      { id: 2, title: 'B', price: 200, compareAtPrice: null, date: '2024-01-01' },
      { id: 1, title: 'A', price: 150, compareAtPrice: null, date: '2024-01-02' },
    ]);
    const result = await repo.getById(1);
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.id === 1)).toBe(true);
  });

  it('appends entry', async () => {
    const repo = new JsonPriceHistoryRepository(tmpFile('price_history.json'));
    await repo.saveAll([
      { id: 1, title: 'A', price: 100, compareAtPrice: null, date: '2024-01-01' },
    ]);
    await repo.append({ id: 1, title: 'A', price: 120, compareAtPrice: null, date: '2024-01-02' });
    expect(await repo.getAll()).toHaveLength(2);
  });
});

describe('JsonDisappearedRepository', () => {
  it('returns empty array when file does not exist', async () => {
    const repo = new JsonDisappearedRepository(tmpFile('products_seen.json'));
    expect(await repo.getAll()).toEqual([]);
  });

  it('saves and retrieves disappeared products', async () => {
    const repo = new JsonDisappearedRepository(tmpFile('products_seen.json'));
    const items: DisappearedProduct[] = [
      { id: 1, title: 'Gone', lastPrice: 1000, lastSeen: '2024-01-01', disappearedOn: '2024-01-02' },
    ];
    await repo.saveAll(items);
    expect(await repo.getAll()).toEqual(items);
  });

  it('adds disappeared product without duplicates', async () => {
    const repo = new JsonDisappearedRepository(tmpFile('products_seen.json'));
    const item: DisappearedProduct = {
      id: 1, title: 'Gone', lastPrice: 1000, lastSeen: '2024-01-01', disappearedOn: '2024-01-02',
    };
    await repo.add(item);
    await repo.add(item);
    expect(await repo.getAll()).toHaveLength(1);
  });

  it('gets by id', async () => {
    const repo = new JsonDisappearedRepository(tmpFile('products_seen.json'));
    await repo.saveAll([
      { id: 1, title: 'A', lastPrice: 100, lastSeen: '2024-01-01', disappearedOn: '2024-01-02' },
      { id: 2, title: 'B', lastPrice: 200, lastSeen: '2024-01-01', disappearedOn: '2024-01-02' },
    ]);
    const found = await repo.getById(1);
    expect(found?.title).toBe('A');
    expect(await repo.getById(999)).toBeNull();
  });
});