import { useMutation } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { OrderRequest, OrderResponse } from '../types';

export function assembleCart(data: OrderRequest): Promise<OrderResponse> {
  return apiFetch<OrderResponse>('/order', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function useAssembleCart() {
  return useMutation({
    mutationFn: assembleCart,
  });
}