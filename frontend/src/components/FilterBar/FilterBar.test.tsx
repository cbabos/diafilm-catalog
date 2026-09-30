import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterBar } from './FilterBar';

describe('FilterBar', () => {
  const defaultProps = {
    currentFilter: 'all' as const,
    hideBought: true,
    selectedCount: 3,
    boughtCount: 5,
    onFilterChange: vi.fn(),
    onToggleHideBought: vi.fn(),
  };

  it('renders all filter buttons', () => {
    render(<FilterBar {...defaultProps} />);
    expect(screen.getByText('Összes')).toBeInTheDocument();
    expect(screen.getByText('Akciós')).toBeInTheDocument();
    expect(screen.getByText('Kijelölt (3)')).toBeInTheDocument();
    expect(screen.getByText('Megvett (5)')).toBeInTheDocument();
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
});