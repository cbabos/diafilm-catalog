import { useUIStore } from '../store/uiStore';
import type { FilterType } from '../types';

/**
 * Hook to access and manipulate local filter state from the Zustand store.
 * Provides filter, hideBought, and actions to change them.
 */
export function useLocalFilter() {
  const filter = useUIStore((s) => s.filter);
  const hideBought = useUIStore((s) => s.hideBought);
  const setFilter = useUIStore((s) => s.setFilter);
  const toggleHideBought = useUIStore((s) => s.toggleHideBought);

  return {
    filter,
    hideBought,
    setFilter: (f: FilterType) => setFilter(f),
    toggleHideBought,
  };
}