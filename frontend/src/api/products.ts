import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { Product } from '../types';

export function fetchProducts(): Promise<Product[]> {
  return apiFetch<Product[]>('/products');
}

export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}