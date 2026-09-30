import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProductCard } from './ProductCard';
import type { Product } from '../../types';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 1,
    title: 'Test Diafilm',
    handle: 'test-diafilm',
    url: 'https://diafilm.hu/products/test',
    variantId: 12345,
    price: 1690,
    compareAtPrice: null,
    available: true,
    tags: ['kaland', 'családi'],
    productType: 'diafilm',
    vendor: 'Diafilm Kft',
    imageUrl: 'https://example.com/img.jpg',
    ...overrides,
  };
}

describe('ProductCard', () => {
  const defaultProps = {
    isSelected: false,
    isBought: false,
    boughtInfo: null,
    priceHistoryCount: 0,
    onToggleSelect: vi.fn(),
    onShowPriceHistory: vi.fn(),
  };

  it('renders product title and price', () => {
    render(<ProductCard product={makeProduct()} {...defaultProps} />);
    expect(screen.getByText(/Test Diafilm/)).toBeInTheDocument();
    expect(screen.getByText(/1690/)).toBeInTheDocument();
  });

  it('renders tags', () => {
    render(<ProductCard product={makeProduct()} {...defaultProps} />);
    expect(screen.getByText('kaland · családi')).toBeInTheDocument();
  });

  it('renders image with correct src and alt', () => {
    render(<ProductCard product={makeProduct()} {...defaultProps} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/img.jpg');
    expect(img).toHaveAttribute('alt', 'Test Diafilm');
  });

  it('renders product link with target _blank', () => {
    render(<ProductCard product={makeProduct()} {...defaultProps} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://diafilm.hu/products/test');
    expect(link).toHaveAttribute('target', '_blank');
  });

  // Checkbox / selection
  it('calls onToggleSelect when checkbox is clicked', () => {
    const onToggleSelect = vi.fn();
    render(<ProductCard product={makeProduct()} {...defaultProps} onToggleSelect={onToggleSelect} />);
    fireEvent.click(screen.getByTestId('select-box'));
    expect(onToggleSelect).toHaveBeenCalledWith(1);
  });

  it('shows checked state when selected', () => {
    render(<ProductCard product={makeProduct()} {...defaultProps} isSelected={true} />);
    const checkbox = screen.getByTestId('select-box');
    expect(checkbox).toHaveAttribute('aria-checked', 'true');
  });

  // Sale badge
  it('renders sale badge and discount when on sale', () => {
    render(
      <ProductCard
        product={makeProduct({ price: 800, compareAtPrice: 1000 })}
        {...defaultProps}
      />,
    );
    expect(screen.getByText('Akció')).toBeInTheDocument();
    expect(screen.getByText('-20%')).toBeInTheDocument();
  });

  it('renders compare-at price with line-through when on sale', () => {
    render(
      <ProductCard
        product={makeProduct({ price: 800, compareAtPrice: 1000 })}
        {...defaultProps}
      />,
    );
    expect(screen.getByText(/1000/)).toBeInTheDocument();
  });

  // Bought info
  it('renders bought info with price paid and date', () => {
    render(
      <ProductCard
        product={makeProduct()}
        {...defaultProps}
        isBought={true}
        boughtInfo={{ pricePaid: 1500, date: '2024-01-15T10:00:00.000Z' }}
      />,
    );
    expect(screen.getByText(/✓/)).toBeInTheDocument();
    expect(screen.getByText(/1500/)).toBeInTheDocument();
  });

  it('shows price change indicator when current price differs from paid price', () => {
    render(
      <ProductCard
        product={makeProduct({ price: 2000 })}
        {...defaultProps}
        isBought={true}
        boughtInfo={{ pricePaid: 1500, date: '2024-01-15T10:00:00.000Z' }}
      />,
    );
    expect(screen.getByText(/↑/)).toBeInTheDocument();
  });

  it('shows down arrow when current price is lower than paid', () => {
    render(
      <ProductCard
        product={makeProduct({ price: 1000 })}
        {...defaultProps}
        isBought={true}
        boughtInfo={{ pricePaid: 1500, date: '2024-01-15T10:00:00.000Z' }}
      />,
    );
    expect(screen.getByText(/↓/)).toBeInTheDocument();
  });

  // Price history icon
  it('renders price history icon when count > 1', () => {
    render(<ProductCard product={makeProduct()} {...defaultProps} priceHistoryCount={3} />);
    expect(screen.getByTestId('history-icon')).toBeInTheDocument();
  });

  it('does not render price history icon when count <= 1', () => {
    render(<ProductCard product={makeProduct()} {...defaultProps} priceHistoryCount={1} />);
    expect(screen.queryByTestId('history-icon')).not.toBeInTheDocument();
  });

  it('calls onShowPriceHistory when history icon clicked', () => {
    const onShowPriceHistory = vi.fn();
    render(
      <ProductCard
        product={makeProduct()}
        {...defaultProps}
        priceHistoryCount={3}
        onShowPriceHistory={onShowPriceHistory}
      />,
    );
    fireEvent.click(screen.getByTestId('history-icon'));
    expect(onShowPriceHistory).toHaveBeenCalledWith(1);
  });

  // Discontinued
  it('renders discontinued badge and no link for discontinued products', () => {
    const discontinuedProduct = { ...makeProduct(), _discontinued: true } as Product;
    render(<ProductCard product={discontinuedProduct} {...defaultProps} />);
    expect(screen.getByText('Nem elérhető')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});