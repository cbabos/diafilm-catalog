import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';

export function fetchSelection(): Promise<number[]> {
  return apiFetch<number[]>('/selection');
}

export function useSelection() {
  return useQuery({
    queryKey: ['selection'],
    queryFn: fetchSelection,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateSelection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: number[]) =>
      apiFetch<number[]>('/selection', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['selection'] });
    },
  });
}