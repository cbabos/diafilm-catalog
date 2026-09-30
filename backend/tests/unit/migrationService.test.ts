import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { MigrationService } from '../../src/services/MigrationService.js';
import { JsonBoughtRepository } from '../../src/repositories/BoughtRepository.js';
import { JsonProductRepository } from '../../src/repositories/ProductRepository.js';
import { JsonDisappearedRepository } from '../../src/repositories/DisappearedRepository.js';
import type { Product } from '../../src/types.js';

let tmpDir: string;

function makeProduct(id: number, title: string): Product {
  return {
    id,
    title,
    handle: `handle-${id}`,
    url: `https://diafilm.hu/products/handle-${id}`,
    variantId: id * 10,
    price: 1000,
    compareAtPrice: null,
    available: true,
    tags: [],
    productType: '',
    vendor: 'Diafilm',
    imageUrl: null,
  };
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diafilm-migration-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('MigrationService', () => {
  it('does not migrate when bought.json is empty', async () => {
    const boughtRepo = new JsonBoughtRepository(path.join(tmpDir, 'bought.json'));
    const productRepo = new JsonProductRepository(path.join(tmpDir, 'products.json'));
    const disappearedRepo = new JsonDisappearedRepository(path.join(tmpDir, 'products_seen.json'));

    const service = new MigrationService(boughtRepo, productRepo, disappearedRepo);
    const result = await service.migrateIfNeeded();

    expect(result.migrated).toBe(false);
    expect(result.count).toBe(0);
  });

  it('does not migrate when already enriched format', async () => {
    const boughtRepo = new JsonBoughtRepository(path.join(tmpDir, 'bought.json'));
    const productRepo = new JsonProductRepository(path.join(tmpDir, 'products.json'));
    const disappearedRepo = new JsonDisappearedRepository(path.join(tmpDir, 'products_seen.json'));

    // Save enriched format
    await boughtRepo.saveAll([
      { id: 1, boughtAt: '2024-01-01T00:00:00Z', product: makeProduct(1, 'Test') },
    ]);

    const service = new MigrationService(boughtRepo, productRepo, disappearedRepo);
    const result = await service.migrateIfNeeded();

    expect(result.migrated).toBe(false);
    expect(result.count).toBe(0);
  });

  it('migrates bare IDs to enriched snapshots using product data', async () => {
    const boughtRepo = new JsonBoughtRepository(path.join(tmpDir, 'bought.json'));
    const productRepo = new JsonProductRepository(path.join(tmpDir, 'products.json'));
    const disappearedRepo = new JsonDisappearedRepository(path.join(tmpDir, 'products_seen.json'));

    // Set up products
    await productRepo.saveAll([makeProduct(1, 'Product One'), makeProduct(2, 'Product Two')]);

    // Write bare IDs
    fs.writeFileSync(path.join(tmpDir, 'bought.json'), JSON.stringify([1, 2]));

    const service = new MigrationService(boughtRepo, productRepo, disappearedRepo);
    const result = await service.migrateIfNeeded();

    expect(result.migrated).toBe(true);
    expect(result.count).toBe(2);

    const migrated = await boughtRepo.getAll();
    expect(migrated).toHaveLength(2);
    expect(migrated[0].id).toBe(1);
    expect(migrated[0].boughtAt).toBeTruthy();
    expect(migrated[0].product.title).toBe('Product One');
    expect(migrated[1].product.title).toBe('Product Two');
  });

  it('uses disappeared data for products not in current scrape', async () => {
    const boughtRepo = new JsonBoughtRepository(path.join(tmpDir, 'bought.json'));
    const productRepo = new JsonProductRepository(path.join(tmpDir, 'products.json'));
    const disappearedRepo = new JsonDisappearedRepository(path.join(tmpDir, 'products_seen.json'));

    // No products, but product 99 is in disappeared list
    await disappearedRepo.saveAll([
      { id: 99, title: 'Disappeared Product', lastPrice: 500, lastSeen: '2024-01-01', disappearedOn: '2024-01-02' },
    ]);

    // Write bare ID for disappeared product
    fs.writeFileSync(path.join(tmpDir, 'bought.json'), JSON.stringify([99]));

    const service = new MigrationService(boughtRepo, productRepo, disappearedRepo);
    const result = await service.migrateIfNeeded();

    expect(result.migrated).toBe(true);
    const migrated = await boughtRepo.getAll();
    expect(migrated[0].product.title).toBe('Disappeared Product');
    expect(migrated[0].product.price).toBe(500);
    expect(migrated[0].product.available).toBe(false);
  });

  it('uses stub for unknown products (not in products or disappeared)', async () => {
    const boughtRepo = new JsonBoughtRepository(path.join(tmpDir, 'bought.json'));
    const productRepo = new JsonProductRepository(path.join(tmpDir, 'products.json'));
    const disappearedRepo = new JsonDisappearedRepository(path.join(tmpDir, 'products_seen.json'));

    // No products, no disappeared
    fs.writeFileSync(path.join(tmpDir, 'bought.json'), JSON.stringify([999]));

    const service = new MigrationService(boughtRepo, productRepo, disappearedRepo);
    const result = await service.migrateIfNeeded();

    expect(result.migrated).toBe(true);
    const migrated = await boughtRepo.getAll();
    expect(migrated[0].product.title).toBe('Ismeretlen (törölve)');
    expect(migrated[0].product.price).toBe(0);
  });

  it('migrates bare IDs when first item is a bare number (even if later items are enriched)', async () => {
    const boughtRepo = new JsonBoughtRepository(path.join(tmpDir, 'bought.json'));
    const productRepo = new JsonProductRepository(path.join(tmpDir, 'products.json'));
    const disappearedRepo = new JsonDisappearedRepository(path.join(tmpDir, 'products_seen.json'));

    await productRepo.saveAll([makeProduct(2, 'Product Two')]);

    // Mixed: first is bare ID (determines legacy), second is already enriched
    fs.writeFileSync(
      path.join(tmpDir, 'bought.json'),
      JSON.stringify([
        2,
        { id: 1, boughtAt: '2024-01-01T00:00:00Z', product: makeProduct(1, 'Already Enriched') },
      ]),
    );

    const service = new MigrationService(boughtRepo, productRepo, disappearedRepo);
    const result = await service.migrateIfNeeded();

    expect(result.migrated).toBe(true);
    expect(result.count).toBe(2);

    const migrated = await boughtRepo.getAll();
    // First item migrated from bare ID
    expect(migrated.find((b) => b.id === 2)?.product.title).toBe('Product Two');
    // Second item preserved as-is
    expect(migrated.find((b) => b.id === 1)?.product.title).toBe('Already Enriched');
  });
});