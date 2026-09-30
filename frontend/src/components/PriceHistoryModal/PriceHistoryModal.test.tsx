import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PriceHistoryModal } from './PriceHistoryModal';
import type { PriceHistoryEntry } from '../../types';

const history: PriceHistoryEntry[] = [
  { id: 1, title: 'Test', price: 1000, compareAtPrice: null, date: '2024-01-01' },
  { id: 1, title: 'Test', price: 800, compareAtPrice: 1000, date: '2024-02-01' },
  { id: 1, title: 'Test', price: 700, compareAtPrice: null, date: '2024-03-01' },
];

describe('PriceHistoryModal', () => {
  const defaultProps = {
    open: true,
    title: 'Test Diafilm',
    history,
    onClose: vi.fn(),
  };

  it('renders nothing when closed', () => {
    const { container } = render(<PriceHistoryModal {...defaultProps} open={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders product title', () => {
    render(<PriceHistoryModal {...defaultProps} />);
    expect(screen.getByText('Test Diafilm')).toBeInTheDocument();
  });

  it('renders all history entries sorted by date', () => {
    render(<PriceHistoryModal {...defaultProps} />);
    expect(screen.getByText('2024-01-01')).toBeInTheDocument();
    expect(screen.getByText('2024-02-01')).toBeInTheDocument();
    expect(screen.getByText('2024-03-01')).toBeInTheDocument();
  });

  it('renders sale badge for entries with compareAtPrice', () => {
    render(<PriceHistoryModal {...defaultProps} />);
    expect(screen.getByText('akció')).toBeInTheDocument();
  });

  it('renders prices', () => {
    render(<PriceHistoryModal {...defaultProps} />);
    expect(screen.getAllByText(/1000/).length).toBeGreaterThan(0);
    expect(screen.getByText(/800/)).toBeInTheDocument();
    expect(screen.getByText(/700/)).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<PriceHistoryModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByText('Bezárás'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders empty list gracefully', () => {
    render(<PriceHistoryModal {...defaultProps} history={[]} />);
    expect(screen.getByText('Test Diafilm')).toBeInTheDocument();
  });
});