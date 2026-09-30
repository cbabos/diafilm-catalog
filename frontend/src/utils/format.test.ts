import { describe, it, expect } from 'vitest';
import { formatPrice, formatDate, discountPercent } from './format';

describe('formatPrice', () => {
  it('formats HUF with Ft suffix', () => {
    const result = formatPrice(1690);
    expect(result).toContain('Ft');
    // Should contain the number (with or without locale separators)
    expect(result).toMatch(/1[^\d]*690/);
  });

  it('handles zero', () => {
    expect(formatPrice(0)).toContain('0');
  });

  it('handles large numbers', () => {
    const result = formatPrice(1000000);
    // Number may be formatted with locale separators
    expect(result).toMatch(/1[^\d]*000[^\d]*000/);
    expect(result).toContain('Ft');
  });
});

describe('formatDate', () => {
  it('formats ISO date to a readable string', () => {
    const result = formatDate('2024-01-15T10:30:00.000Z');
    expect(result).toContain('2024');
  });

  it('returns empty string for empty input', () => {
    expect(formatDate('')).toBe('');
  });
});

describe('discountPercent', () => {
  it('calculates percentage discount', () => {
    expect(discountPercent(800, 1000)).toBe(20);
    expect(discountPercent(500, 1000)).toBe(50);
    expect(discountPercent(1690, 2000)).toBe(16); // rounded
  });

  it('handles 0% discount (same price)', () => {
    expect(discountPercent(1000, 1000)).toBe(0);
  });

  it('handles 100% discount (free)', () => {
    expect(discountPercent(0, 1000)).toBe(100);
  });
});