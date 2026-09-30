import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProductList } from './ProductList';
import type { Product, BoughtItem } from '../../types';

function makeProduct(id: number, title: string): Product {
  return {
    id,
    title,
    handle: `handle-${id}`,
    url: `https://example.com/${id}`,
    variantId: id * 10,
    price: id * 1000,
    compareAtPrice: null,
    available: true,
    tags: ['tag1'],
    productType: 'test',
    vendor: 'test',
    imageUrl: null,
  };
}

describe('ProductList', () => {
  const products = [makeProduct(1, 'Alpha'), makeProduct(2, 'Beta')];

  const defaultProps = {
    selectedIds: new Set<number>(),
    boughtMap: new Map<number, BoughtItem>(),
    priceHistoryCounts: new Map<number, number>(),
    onToggleSelect: vi.fn(),
    onShowPriceHistory: vi.fn(),
  };

  it('renders loading state', () => {
    render(<ProductList {...defaultProps} products={[]} loading={true} />);
    expect(screen.getByText('Betöltés...')).toBeInTheDocument();
  });

  it('renders error state', () => {
    render(
      <ProductList {...defaultProps} products={[]} error={new Error('Network error')} />,
    );
    expect(screen.getByText(/Hiba: Network error/)).toBeInTheDocument();
  });

  it('renders empty state when no products', () => {
    render(<ProductList {...defaultProps} products={[]} />);
    expect(screen.getByText('Nincs találat 🎞️')).toBeInTheDocument();
  });

  it('renders all products', () => {
    render(<ProductList {...defaultProps} products={products} />);
    expect(screen.getAllByTestId('product-card')).toHaveLength(2);
  });

  it('passes selected state to ProductCard', () => {
    render(
      <ProductList
        {...defaultProps}
        products={products}
        selectedIds={new Set([1])}
      />,
    );
    const cards = screen.getAllByTestId('product-card');
    const checkbox = cards[0].querySelector('[data-testid="select-box"]');
    expect(checkbox).toHaveAttribute('aria-checked', 'true');
  });

  it('passes bought state to ProductCard', () => {
    const boughtMap = new Map<number, BoughtItem>([
      [1, { id: 1, boughtAt: '2024-01-01', product: products[0] }],
    ]);
    render(
      <ProductList
        {...defaultProps}
        products={products}
        boughtMap={boughtMap}
      />,
    );
    const cards = screen.getAllByTestId('product-card');
    // Bought card should have bought class (opacity)
    expect(cards[0].className).toMatch(/bought/);
  });

  it('passes price history count to ProductCard', () => {
    render(
      <ProductList
        {...defaultProps}
        products={products}
        priceHistoryCounts={new Map([[1, 5]])}
      />,
    );
    // Product 1 has 5 history entries → should show icon
    expect(screen.getByTestId('history-icon')).toBeInTheDocument();
  });
});