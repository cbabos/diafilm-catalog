import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BottomBar } from './BottomBar';

describe('BottomBar', () => {
  const defaultProps = {
    selectedCount: 0,
    selectedTotal: 0,
    hasBoughtInSelection: false,
    onClearSelection: vi.fn(),
    onOrder: vi.fn(),
    onRemoveBought: vi.fn(),
  };

  it('renders selection count and total', () => {
    render(<BottomBar {...defaultProps} selectedCount={3} selectedTotal={5000} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText(/5000/)).toBeInTheDocument();
  });

  it('disables order button when count is 0', () => {
    render(<BottomBar {...defaultProps} selectedCount={0} />);
    expect(screen.getByTestId('order-btn')).toBeDisabled();
  });

  it('enables order button when count > 0', () => {
    render(<BottomBar {...defaultProps} selectedCount={1} selectedTotal={1000} />);
    expect(screen.getByTestId('order-btn')).not.toBeDisabled();
  });

  it('hides remove-bought button when hasBoughtInSelection is false', () => {
    render(<BottomBar {...defaultProps} hasBoughtInSelection={false} />);
    expect(screen.queryByTestId('remove-bought-btn')).not.toBeInTheDocument();
  });

  it('shows remove-bought button when hasBoughtInSelection is true', () => {
    render(
      <BottomBar
        {...defaultProps}
        selectedCount={2}
        selectedTotal={2000}
        hasBoughtInSelection={true}
      />,
    );
    expect(screen.getByTestId('remove-bought-btn')).toBeInTheDocument();
  });

  it('calls onOrder when order button clicked', () => {
    const onOrder = vi.fn();
    render(
      <BottomBar
        {...defaultProps}
        selectedCount={1}
        selectedTotal={1000}
        onOrder={onOrder}
      />,
    );
    fireEvent.click(screen.getByTestId('order-btn'));
    expect(onOrder).toHaveBeenCalledTimes(1);
  });

  it('calls onClearSelection when clear button clicked', () => {
    const onClearSelection = vi.fn();
    render(
      <BottomBar
        {...defaultProps}
        selectedCount={1}
        selectedTotal={1000}
        onClearSelection={onClearSelection}
      />,
    );
    fireEvent.click(screen.getByText('Törlés'));
    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });

  it('calls onRemoveBought when remove button clicked', () => {
    const onRemoveBought = vi.fn();
    render(
      <BottomBar
        {...defaultProps}
        selectedCount={1}
        selectedTotal={1000}
        hasBoughtInSelection={true}
        onRemoveBought={onRemoveBought}
      />,
    );
    fireEvent.click(screen.getByTestId('remove-bought-btn'));
    expect(onRemoveBought).toHaveBeenCalledTimes(1);
  });
});