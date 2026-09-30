import { create } from 'zustand';
import type { FilterType, ModalType } from '../types';

interface UIState {
  // Filter + search
  filter: FilterType;
  hideBought: boolean;
  searchTerm: string;
  debouncedSearch: string;

  // Modal state
  activeModal: ModalType;
  priceHistoryProductId: number | null;

  // Actions
  setFilter: (filter: FilterType) => void;
  toggleHideBought: () => void;
  setSearchTerm: (term: string) => void;
  setDebouncedSearch: (term: string) => void;
  openModal: (modal: ModalType) => void;
  closeModal: () => void;
  setPriceHistoryProductId: (id: number | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  filter: 'all',
  hideBought: true,
  searchTerm: '',
  debouncedSearch: '',

  activeModal: null,
  priceHistoryProductId: null,

  setFilter: (filter) => set({ filter }),
  toggleHideBought: () => set((state) => ({ hideBought: !state.hideBought })),
  setSearchTerm: (term) => set({ searchTerm: term }),
  setDebouncedSearch: (term) => set({ debouncedSearch: term }),
  openModal: (modal) => set({ activeModal: modal }),
  closeModal: () => set({ activeModal: null, priceHistoryProductId: null }),
  setPriceHistoryProductId: (id) => set({ priceHistoryProductId: id }),
}));