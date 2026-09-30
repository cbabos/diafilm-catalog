import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { BoughtItem } from '../types';

export function fetchBought(): Promise<BoughtItem[]> {
  return apiFetch<BoughtItem[]>('/bought');
}

export function useBought() {
  return useQuery({
    queryKey: ['bought'],
    queryFn: fetchBought,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateBought() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BoughtItem[]) =>
      apiFetch<BoughtItem[]>('/bought', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bought'] });
    },
  });
}