import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FilterBar } from './FilterBar';
import type { RenderProduct } from '../../types';

function makeProduct(id: number, title: string, price: number): RenderProduct {
  return {
    id,
    title,
    handle: `handle-${id}`,
    url: `https://example.com/${id}`,
    variantId: id * 10,
    price,
    compareAtPrice: null,
    available: true,
    tags: [],
    productType: 'test',
    vendor: 'test',
    imageUrl: null,
  };
}

describe('FilterBar', () => {
  const filteredProducts: RenderProduct[] = [
    makeProduct(1, 'Alpha', 1000),
    makeProduct(2, 'Beta', 2000),
  ];

  const defaultProps = {
    currentFilter: 'all' as const,
    hideBought: true,
    selectedCount: 3,
    boughtCount: 5,
    notInterestedCount: 2,
    filteredProducts,
    onFilterChange: vi.fn(),
    onToggleHideBought: vi.fn(),
  };

  it('renders all filter buttons', () => {
    render(<FilterBar {...defaultProps} />);
    expect(screen.getByText('Összes')).toBeInTheDocument();
    expect(screen.getByText('Akciós')).toBeInTheDocument();
    expect(screen.getByText('Kijelölt (3)')).toBeInTheDocument();
    expect(screen.getByText('Megvett (5)')).toBeInTheDocument();
    expect(screen.getByText('Nem érdekel (2)')).toBeInTheDocument();
    expect(screen.getByText('Elrejti vásároltakat')).toBeInTheDocument();
  });

  it('highlights active filter', () => {
    render(<FilterBar {...defaultProps} currentFilter="sale" />);
    const saleBtn = screen.getByText('Akciós');
    expect(saleBtn.className).toMatch(/active/);
  });

  it('calls onFilterChange when clicking a filter', () => {
    const onFilterChange = vi.fn();
    render(<FilterBar {...defaultProps} onFilterChange={onFilterChange} />);
    fireEvent.click(screen.getByText('Akciós'));
    expect(onFilterChange).toHaveBeenCalledWith('sale');
  });

  it('calls onToggleHideBought when clicking hide bought', () => {
    const onToggleHideBought = vi.fn();
    render(<FilterBar {...defaultProps} onToggleHideBought={onToggleHideBought} />);
    fireEvent.click(screen.getByText('Elrejti vásároltakat'));
    expect(onToggleHideBought).toHaveBeenCalledTimes(1);
  });

  it('highlights hideBought when active', () => {
    render(<FilterBar {...defaultProps} hideBought={true} />);
    const hideBtn = screen.getByText('Elrejti vásároltakat');
    expect(hideBtn.className).toMatch(/active/);
  });

  it('does not highlight hideBought when inactive', () => {
    render(<FilterBar {...defaultProps} hideBought={false} />);
    const hideBtn = screen.getByText('Elrejti vásároltakat');
    expect(hideBtn.className).not.toMatch(/active/);
  });

  it('renders copy list button', () => {
    render(<FilterBar {...defaultProps} />);
    expect(screen.getByTestId('copy-list-btn')).toBeInTheDocument();
  });

  it('disables copy button when no products', () => {
    render(<FilterBar {...defaultProps} filteredProducts={[]} />);
    expect(screen.getByTestId('copy-list-btn')).toBeDisabled();
  });

  it('copies filtered list to clipboard on click', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });
    Object.assign(window, { ClipboardItem: vi.fn() });

    render(<FilterBar {...defaultProps} />);
    fireEvent.click(screen.getByTestId('copy-list-btn'));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1);
    });
    const copiedText = writeText.mock.calls[0][0] as string;
    expect(copiedText).toContain('Alpha');
    expect(copiedText).toContain('Beta');
    expect(copiedText).toContain('3000 Ft');
    expect(copiedText).toContain('2 db');
  });

  it('includes filter name in copied text', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });
    Object.assign(window, { ClipboardItem: vi.fn() });

    render(<FilterBar {...defaultProps} currentFilter="sale" />);
    fireEvent.click(screen.getByTestId('copy-list-btn'));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1);
    });
    expect(writeText.mock.calls[0][0]).toContain('Akciós');
  });

  it('shows copied confirmation after successful copy', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });
    Object.assign(window, { ClipboardItem: vi.fn() });

    render(<FilterBar {...defaultProps} />);
    fireEvent.click(screen.getByTestId('copy-list-btn'));

    await waitFor(() => {
      expect(screen.getByText('✅ Másolva!')).toBeInTheDocument();
    });
  });

  it('marks discontinued products in copied text', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });
    Object.assign(window, { ClipboardItem: vi.fn() });

    const discontinued: RenderProduct[] = [
      { ...makeProduct(3, 'Gamma', 500), _discontinued: true },
    ];
    render(<FilterBar {...defaultProps} filteredProducts={discontinued} />);
    fireEvent.click(screen.getByTestId('copy-list-btn'));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1);
    });
    expect(writeText.mock.calls[0][0]).toContain('(kifutott)');
  });
});