import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { PriceHistoryEntry } from '../types';

export function fetchAllPriceHistory(): Promise<PriceHistoryEntry[]> {
  return apiFetch<PriceHistoryEntry[]>('/price-history');
}

export function fetchPriceHistoryForProduct(id: number): Promise<PriceHistoryEntry[]> {
  return apiFetch<PriceHistoryEntry[]>(`/price-history/${id}`);
}

export function usePriceHistory() {
  return useQuery({
    queryKey: ['price-history'],
    queryFn: fetchAllPriceHistory,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePriceHistoryForProduct(id: number | null) {
  return useQuery({
    queryKey: ['price-history', id],
    queryFn: () => fetchPriceHistoryForProduct(id!),
    enabled: id != null,
    staleTime: 5 * 60 * 1000,
  });
}