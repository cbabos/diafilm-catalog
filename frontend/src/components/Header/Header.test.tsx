import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Header } from './Header';

describe('Header', () => {
  it('renders title with count', () => {
    render(<Header totalCount={42} />);
    expect(screen.getByText('🎬 Diafilm Katalógus')).toBeInTheDocument();
    expect(screen.getByText('(42 diafilm)')).toBeInTheDocument();
  });

  it('renders children', () => {
    render(
      <Header totalCount={0}>
        <div data-testid="child">Search</div>
      </Header>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('renders zero count', () => {
    render(<Header totalCount={0} />);
    expect(screen.getByText('(0 diafilm)')).toBeInTheDocument();
  });
});