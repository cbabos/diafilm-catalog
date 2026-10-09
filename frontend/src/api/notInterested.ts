import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';

export function fetchNotInterested(): Promise<number[]> {
  return apiFetch<number[]>('/not-interested');
}

export function useNotInterested() {
  return useQuery({
    queryKey: ['not-interested'],
    queryFn: fetchNotInterested,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateNotInterested() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: number[]) =>
      apiFetch<{ ok: boolean; count: number }>('/not-interested', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['not-interested'] });
    },
  });
}