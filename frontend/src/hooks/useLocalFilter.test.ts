import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUIStore } from '../store/uiStore';
import { useLocalFilter } from './useLocalFilter';

describe('useLocalFilter', () => {
  beforeEach(() => {
    // Reset store to initial state
    useUIStore.setState({
      filter: 'all',
      hideBought: true,
      searchTerm: '',
      debouncedSearch: '',
      activeModal: null,
      priceHistoryProductId: null,
    });
  });

  it('returns initial filter state', () => {
    const { result } = renderHook(() => useLocalFilter());
    expect(result.current.filter).toBe('all');
    expect(result.current.hideBought).toBe(true);
  });

  it('setFilter updates filter', () => {
    const { result } = renderHook(() => useLocalFilter());
    act(() => result.current.setFilter('sale'));
    expect(result.current.filter).toBe('sale');
  });

  it('toggleHideBought toggles hideBought', () => {
    const { result } = renderHook(() => useLocalFilter());
    act(() => result.current.toggleHideBought());
    expect(result.current.hideBought).toBe(false);
    act(() => result.current.toggleHideBought());
    expect(result.current.hideBought).toBe(true);
  });
});