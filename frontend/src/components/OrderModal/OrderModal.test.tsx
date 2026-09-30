import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OrderModal } from './OrderModal';
import type { Product, OrderResponse } from '../../types';

function makeProduct(id: number, title: string, price: number): Product {
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

describe('OrderModal', () => {
  const products = [makeProduct(1, 'Alpha', 1000), makeProduct(2, 'Beta', 2000)];

  const defaultProps = {
    open: true,
    selectedProducts: products,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    onAssembleCart: vi.fn(),
  };

  it('renders nothing when closed', () => {
    const { container } = render(<OrderModal {...defaultProps} open={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders order summary with count and total', () => {
    render(<OrderModal {...defaultProps} />);
    expect(screen.getByText(/2 diafilm/)).toBeInTheDocument();
    expect(screen.getByText(/3000/)).toBeInTheDocument();
  });

  it('renders product list', () => {
    render(<OrderModal {...defaultProps} />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('starts at assemble step', () => {
    render(<OrderModal {...defaultProps} />);
    expect(screen.getByTestId('step-assemble')).toBeInTheDocument();
  });

  it('shows assemble button', () => {
    render(<OrderModal {...defaultProps} />);
    expect(screen.getByTestId('assemble-btn')).toBeInTheDocument();
  });

  it('transitions to checkout step on successful assemble', async () => {
    const onAssembleCart = vi.fn().mockResolvedValue({
      ok: true,
      cartToken: 'token123',
      checkoutUrl: 'https://diafilm.hu/checkout/abc',
      itemCount: 2,
      totalPrice: 300000,
    } as OrderResponse);

    render(<OrderModal {...defaultProps} onAssembleCart={onAssembleCart} />);
    fireEvent.click(screen.getByTestId('assemble-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('step-checkout')).toBeInTheDocument();
    });
    expect(screen.getByText('Pénztár megnyitása →')).toHaveAttribute(
      'href',
      'https://diafilm.hu/checkout/abc',
    );
  });

  it('shows error when assemble fails', async () => {
    const onAssembleCart = vi.fn().mockRejectedValue(new Error('Network error'));
    render(<OrderModal {...defaultProps} onAssembleCart={onAssembleCart} />);
    fireEvent.click(screen.getByTestId('assemble-btn'));

    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeInTheDocument();
    });
  });

  it('transitions to confirmed step on confirm', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onAssembleCart = vi.fn().mockResolvedValue({
      ok: true,
      cartToken: 't',
      checkoutUrl: 'https://example.com',
      itemCount: 1,
      totalPrice: 1000,
    } as OrderResponse);

    render(<OrderModal {...defaultProps} onConfirm={onConfirm} onAssembleCart={onAssembleCart} />);

    // Step 1 → Step 2
    fireEvent.click(screen.getByTestId('assemble-btn'));
    await waitFor(() => screen.getByTestId('step-checkout'));

    // Step 2 → Step 3
    fireEvent.click(screen.getByTestId('confirm-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('step-confirmed')).toBeInTheDocument();
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when cancel clicked', () => {
    const onClose = vi.fn();
    render(<OrderModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByText('Mégse'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});