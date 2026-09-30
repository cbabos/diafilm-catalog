import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { buildServer } from '../../src/server.js';
import type { FastifyInstance } from 'fastify';
import type { Product, BoughtItem } from '../../src/types.js';

let tmpDir: string;
let app: FastifyInstance;

function makeProduct(id: number, title: string, overrides: Partial<Product> = {}): Product {
  return {
    id,
    title,
    handle: `handle-${id}`,
    url: `https://diafilm.hu/products/handle-${id}`,
    variantId: id * 10,
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

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diafilm-int-'));
  app = await buildServer({ dataDir: tmpDir, logger: false });
});

afterEach(async () => {
  await app.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('Integration: Products routes', () => {
  it('GET /api/products returns all products', async () => {
    // Seed products
    const products = [makeProduct(1, 'Alma'), makeProduct(2, 'Banán')];
    fs.writeFileSync(path.join(tmpDir, 'products.json'), JSON.stringify(products, null, 2));

    const res = await app.inject({ method: 'GET', url: '/api/products' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(2);
    // Products should be sorted (saveAll sorts, but we wrote directly)
  });

  it('GET /api/products returns empty array when no products', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/products' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });
});

describe('Integration: Bought routes', () => {
  it('GET /api/bought returns empty array initially', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/bought' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('POST /api/bought saves and GET retrieves', async () => {
    const items: BoughtItem[] = [
      { id: 1, boughtAt: '2024-01-01T00:00:00Z', product: makeProduct(1, 'Test') },
    ];

    const postRes = await app.inject({
      method: 'POST',
      url: '/api/bought',
      payload: items,
    });
    expect(postRes.statusCode).toBe(200);
    expect(postRes.json()).toEqual({ ok: true, count: 1 });

    const getRes = await app.inject({ method: 'GET', url: '/api/bought' });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json()).toHaveLength(1);
    expect(getRes.json()[0].id).toBe(1);
  });

  it('POST /api/bought rejects non-array body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/bought',
      payload: { id: 1 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty('error');
  });

  it('POST /api/bought rejects items without id', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/bought',
      payload: [{ boughtAt: '2024-01-01', product: makeProduct(1, 'Test') }],
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/bought replaces entire list', async () => {
    // First save
    await app.inject({
      method: 'POST',
      url: '/api/bought',
      payload: [{ id: 1, boughtAt: '2024-01-01T00:00:00Z', product: makeProduct(1, 'A') }],
    });
    // Replace with different list
    await app.inject({
      method: 'POST',
      url: '/api/bought',
      payload: [
        { id: 2, boughtAt: '2024-01-02T00:00:00Z', product: makeProduct(2, 'B') },
        { id: 3, boughtAt: '2024-01-03T00:00:00Z', product: makeProduct(3, 'C') },
      ],
    });

    const res = await app.inject({ method: 'GET', url: '/api/bought' });
    const body = res.json();
    expect(body).toHaveLength(2);
    expect(body.map((b: BoughtItem) => b.id)).toEqual([2, 3]);
  });
});

describe('Integration: Selection routes', () => {
  it('GET /api/selection returns empty array initially', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/selection' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('POST /api/selection saves and GET retrieves', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/selection',
      payload: [1, 2, 3],
    });
    expect(postRes.statusCode).toBe(200);
    expect(postRes.json()).toEqual({ ok: true, count: 3 });

    const getRes = await app.inject({ method: 'GET', url: '/api/selection' });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json()).toEqual([1, 2, 3]);
  });

  it('POST /api/selection rejects non-array body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/selection',
      payload: { id: 1 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/selection rejects non-number elements', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/selection',
      payload: [1, 'two', 3],
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('Integration: Price history routes', () => {
  it('GET /api/price-history returns empty array initially', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/price-history' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('GET /api/price-history returns all entries', async () => {
    // Seed price history
    fs.writeFileSync(
      path.join(tmpDir, 'price_history.json'),
      JSON.stringify([
        { id: 1, title: 'A', price: 100, compareAtPrice: null, date: '2024-01-01' },
        { id: 2, title: 'B', price: 200, compareAtPrice: null, date: '2024-01-01' },
      ]),
    );

    const res = await app.inject({ method: 'GET', url: '/api/price-history' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(2);
  });

  it('GET /api/price-history/:id returns entries for one product', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'price_history.json'),
      JSON.stringify([
        { id: 1, title: 'A', price: 100, compareAtPrice: null, date: '2024-01-01' },
        { id: 2, title: 'B', price: 200, compareAtPrice: null, date: '2024-01-01' },
        { id: 1, title: 'A', price: 150, compareAtPrice: null, date: '2024-01-02' },
      ]),
    );

    const res = await app.inject({ method: 'GET', url: '/api/price-history/1' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(2);
    expect(body.every((e: { id: number }) => e.id === 1)).toBe(true);
  });

  it('GET /api/price-history/:id returns empty for unknown product', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/price-history/999' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('GET /api/price-history/:id rejects non-numeric id', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/price-history/abc' });
    expect(res.statusCode).toBe(400);
  });
});

describe('Integration: Disappeared routes', () => {
  it('GET /api/disappeared returns empty array initially', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/disappeared' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('GET /api/disappeared returns disappeared products', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'products_seen.json'),
      JSON.stringify([
        { id: 1, title: 'Gone', lastPrice: 100, lastSeen: '2024-01-01', disappearedOn: '2024-01-02' },
      ]),
    );

    const res = await app.inject({ method: 'GET', url: '/api/disappeared' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
    expect(res.json()[0].title).toBe('Gone');
  });
});

describe('Integration: Health route', () => {
  it('GET /api/health returns status ok with product count', async () => {
    // Seed a product
    fs.writeFileSync(path.join(tmpDir, 'products.json'), JSON.stringify([makeProduct(1, 'Test')]));

    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.products).toBe(1);
    expect(typeof body.uptime).toBe('number');
    expect(body.uptime).toBeGreaterThanOrEqual(0);
  });

  it('GET /api/health returns 0 products when empty', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().products).toBe(0);
  });
});

describe('Integration: 404 handler', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/unknown' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toHaveProperty('error');
    expect(res.json().code).toBe('NOT_FOUND');
  });

  it('returns 404 for non-api routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/foo' });
    expect(res.statusCode).toBe(404);
  });
});

describe('Integration: CORS headers', () => {
  it('includes CORS header in responses when Origin is sent', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { origin: 'http://localhost:5173' },
    });
    expect(res.headers['access-control-allow-origin']).toBeDefined();
  });
});