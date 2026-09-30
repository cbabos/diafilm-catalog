import { describe, it, expect } from 'vitest';
import { sortProducts } from './sortProducts';
import { PROJECTOR_ID } from './normalize';
import type { Product } from '../types';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: Math.random() * 1000000,
    title: 'Test Product',
    handle: 'test-product',
    url: 'https://example.com',
    variantId: 123,
    price: 1000,
    compareAtPrice: null,
    available: true,
    tags: [],
    productType: 'test',
    vendor: 'test',
    imageUrl: null,
    ...overrides,
  };
}

describe('sortProducts', () => {
  it('pins projector to top', () => {
    const products = [
      makeProduct({ id: 1, title: 'Alpha' }),
      makeProduct({ id: PROJECTOR_ID, title: 'Projector' }),
      makeProduct({ id: 2, title: 'Beta' }),
    ];
    const sorted = sortProducts(products);
    expect(sorted[0].id).toBe(PROJECTOR_ID);
  });

  it('sorts on-sale items before non-sale (after projector)', () => {
    const products = [
      makeProduct({ id: 1, title: 'Regular', compareAtPrice: null }),
      makeProduct({ id: 2, title: 'On Sale', compareAtPrice: 2000 }),
    ];
    const sorted = sortProducts(products);
    expect(sorted[0].id).toBe(2); // on sale first
  });

  it('sorts alphabetically by title (Hungarian locale)', () => {
    const products = [
      makeProduct({ id: 1, title: 'Zebra' }),
      makeProduct({ id: 2, title: 'Alma' }),
      makeProduct({ id: 3, title: 'Barack' }),
    ];
    const sorted = sortProducts(products);
    expect(sorted.map((p) => p.title)).toEqual(['Alma', 'Barack', 'Zebra']);
  });

  it('combines all three sort levels: projector → sale → alphabetical', () => {
    const products = [
      makeProduct({ id: 5, title: 'Zebra', compareAtPrice: null }),
      makeProduct({ id: PROJECTOR_ID, title: 'Projector' }),
      makeProduct({ id: 3, title: 'Sale B', compareAtPrice: 2000 }),
      makeProduct({ id: 4, title: 'Sale A', compareAtPrice: 2000 }),
      makeProduct({ id: 1, title: 'Alma', compareAtPrice: null }),
    ];
    const sorted = sortProducts(products);
    expect(sorted.map((p) => p.id)).toEqual([PROJECTOR_ID, 4, 3, 1, 5]);
  });

  it('does not mutate the original array', () => {
    const products = [
      makeProduct({ id: 2, title: 'B' }),
      makeProduct({ id: 1, title: 'A' }),
    ];
    const original = [...products];
    sortProducts(products);
    expect(products.map((p) => p.id)).toEqual(original.map((p) => p.id));
  });

  it('handles empty array', () => {
    expect(sortProducts([])).toEqual([]);
  });

  it('sorts accent-insensitively in Hungarian locale', () => {
    const products = [
      makeProduct({ id: 1, title: 'Árvíz' }),
      makeProduct({ id: 2, title: 'Alma' }),
    ];
    const sorted = sortProducts(products);
    // Both start with 'A' after normalization, so alphabetical order
    expect(sorted[0].id).toBe(2); // 'Alma' < 'Árvíz' → 'alma' < 'arviz'
  });
});