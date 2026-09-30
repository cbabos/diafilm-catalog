import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RemoveBoughtModal } from './RemoveBoughtModal';
import type { Product } from '../../types';

function makeProduct(id: number, title: string): Product {
  return {
    id,
    title,
    handle: `handle-${id}`,
    url: `https://example.com/${id}`,
    variantId: id * 10,
    price: 1000,
    compareAtPrice: null,
    available: true,
    tags: [],
    productType: 'test',
    vendor: 'test',
    imageUrl: null,
  };
}

describe('RemoveBoughtModal', () => {
  const products = [makeProduct(1, 'Alpha'), makeProduct(2, 'Beta')];

  const defaultProps = {
    open: true,
    boughtInSelection: products,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
  };

  it('renders nothing when closed', () => {
    const { container } = render(<RemoveBoughtModal {...defaultProps} open={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders summary with count', () => {
    render(<RemoveBoughtModal {...defaultProps} />);
    expect(screen.getByText(/2 diafilm eltávolítása/)).toBeInTheDocument();
  });

  it('renders list of products to remove', () => {
    render(<RemoveBoughtModal {...defaultProps} />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('calls onClose when cancel clicked', () => {
    const onClose = vi.fn();
    render(<RemoveBoughtModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByText('Mégse'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm and onClose when confirm clicked', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(
      <RemoveBoughtModal {...defaultProps} onConfirm={onConfirm} onClose={onClose} />,
    );
    fireEvent.click(screen.getByTestId('confirm-remove-btn'));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders empty list when no products', () => {
    render(<RemoveBoughtModal {...defaultProps} boughtInSelection={[]} />);
    expect(screen.getByText(/0 diafilm eltávolítása/)).toBeInTheDocument();
  });
});