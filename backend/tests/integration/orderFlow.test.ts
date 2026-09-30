import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { buildServer } from '../../src/server.js';
import type { FastifyInstance } from 'fastify';
import type { Product } from '../../src/types.js';

let tmpDir: string;
let app: FastifyInstance;

function makeProduct(id: number, title: string): Product {
  return {
    id,
    title,
    handle: `handle-${id}`,
    url: `https://diafilm.hu/products/handle-${id}`,
    variantId: id * 10,
    price: 1690,
    compareAtPrice: null,
    available: true,
    tags: [],
    productType: '',
    vendor: 'Diafilm',
    imageUrl: null,
  };
}

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diafilm-order-'));
  app = await buildServer({ dataDir: tmpDir, logger: false });

  // Seed products
  const products = [makeProduct(1, 'Product A'), makeProduct(2, 'Product B')];
  fs.writeFileSync(path.join(tmpDir, 'products.json'), JSON.stringify(products, null, 2));
});

afterEach(async () => {
  await app.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// Mock the global fetch for cart service
function createMockFetch(responses: {
  addStatus?: number;
  addSetCookie?: string[];
  cartJson?: object;
  checkoutStatus?: number;
  checkoutLocation?: string;
}) {
  return vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (url.includes('/cart/add.js')) {
      const headers = new Headers();
      if (responses.addSetCookie) {
        for (const c of responses.addSetCookie) {
          headers.append('set-cookie', c);
        }
      }
      return Promise.resolve(
        new Response('{}', {
          status: responses.addStatus ?? 200,
          headers,
        }),
      );
    }
    if (url.includes('/cart.js')) {
      return Promise.resolve(
        new Response(JSON.stringify(responses.cartJson ?? {
          token: 'test-cart-token',
          item_count: 2,
          total_price: 338000,
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    }
    if (url.includes('/checkout')) {
      const headers = new Headers();
      if (responses.checkoutLocation) {
        headers.set('location', responses.checkoutLocation);
      }
      return Promise.resolve(
        new Response('', {
          status: responses.checkoutStatus ?? 302,
          headers,
        }),
      );
    }
    return Promise.resolve(new Response('{}', { status: 200 }));
  });
}

describe('Integration: Order flow', () => {
  it('POST /api/order with valid variant IDs returns checkout URL', async () => {
    const mockFetch = createMockFetch({
      addSetCookie: ['cart=test-cookie-123; Path=/; HttpOnly'],
      cartJson: { token: 'abc123', item_count: 2, total_price: 338000 },
      checkoutStatus: 302,
      checkoutLocation: 'https://checkout.shopify.com/abc123',
    });

    vi.stubGlobal('fetch', mockFetch);

    const res = await app.inject({
      method: 'POST',
      url: '/api/order',
      payload: { variantIds: [10, 20] },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.cartToken).toBe('abc123');
    expect(body.checkoutUrl).toBe('https://checkout.shopify.com/abc123');
    expect(body.itemCount).toBe(2);
    expect(body.totalPrice).toBe(338000);

    vi.unstubAllGlobals();
  });

  it('POST /api/order rejects empty variantIds', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/order',
      payload: { variantIds: [] },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('No items selected');
  });

  it('POST /api/order rejects missing variantIds', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/order',
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });

  it('POST /api/order rejects non-number variantIds', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/order',
      payload: { variantIds: [10, 'twenty', 30] },
    });

    expect(res.statusCode).toBe(400);
  });

  it('POST /api/order returns 500 on cart add failure', async () => {
    const mockFetch = createMockFetch({
      addStatus: 500,
    });

    vi.stubGlobal('fetch', mockFetch);

    const res = await app.inject({
      method: 'POST',
      url: '/api/order',
      payload: { variantIds: [10] },
    });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toHaveProperty('error');

    vi.unstubAllGlobals();
  });

  it('POST /api/order handles missing checkout redirect location', async () => {
    const mockFetch = createMockFetch({
      cartJson: { token: 'xyz', item_count: 1, total_price: 1690 },
      checkoutStatus: 302,
      checkoutLocation: '', // No location header
    });

    vi.stubGlobal('fetch', mockFetch);

    const res = await app.inject({
      method: 'POST',
      url: '/api/order',
      payload: { variantIds: [10] },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.checkoutUrl).toBe('');

    vi.unstubAllGlobals();
  });

  it('POST /api/order correctly sends form-encoded body to cart/add.js', async () => {
    const mockFetch = createMockFetch({});

    vi.stubGlobal('fetch', mockFetch);

    await app.inject({
      method: 'POST',
      url: '/api/order',
      payload: { variantIds: [100, 200, 300] },
    });

    // Check the first call was to cart/add.js with form-encoded body
    const addCall = mockFetch.mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('/cart/add.js'),
    );

    expect(addCall).toBeDefined();
    const init = addCall![1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toContain('items[0][id]=100');
    expect(init.body).toContain('items[0][quantity]=1');
    expect(init.body).toContain('items[1][id]=200');
    expect(init.body).toContain('items[2][id]=300');

    vi.unstubAllGlobals();
  });
});