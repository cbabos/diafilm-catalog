import { useMemo, useCallback } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Header } from './components/Header/Header';
import { SearchBar } from './components/SearchBar/SearchBar';
import { FilterBar } from './components/FilterBar/FilterBar';
import { ProductList } from './components/ProductList/ProductList';
import { BottomBar } from './components/BottomBar/BottomBar';
import { OrderModal } from './components/OrderModal/OrderModal';
import { RemoveBoughtModal } from './components/RemoveBoughtModal/RemoveBoughtModal';
import { PriceHistoryModal } from './components/PriceHistoryModal/PriceHistoryModal';
import { useProducts } from './api/products';
import { useBought, useUpdateBought } from './api/bought';
import { useSelection, useUpdateSelection } from './api/selection';
import { usePriceHistory, usePriceHistoryForProduct } from './api/priceHistory';
import { useAssembleCart } from './api/order';
import { useUIStore } from './store/uiStore';
import { useDebounce } from './hooks/useDebounce';
import { normalize, matchesSearch } from './utils/normalize';
import { sortProducts } from './utils/sortProducts';
import type { BoughtItem, RenderProduct, OrderResponse } from './types';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppContent() {
  // Server state (TanStack Query)
  const { data: products = [], isLoading: productsLoading, error: productsError } = useProducts();
  const { data: bought = [] } = useBought();
  const { data: selectionArray = [] } = useSelection();
  const { data: priceHistory = [] } = usePriceHistory();
  const updateBought = useUpdateBought();
  const updateSelection = useUpdateSelection();
  const assembleCart = useAssembleCart();

  // Local UI state (Zustand)
  const filter = useUIStore((s) => s.filter);
  const hideBought = useUIStore((s) => s.hideBought);
  const searchTerm = useUIStore((s) => s.searchTerm);
  const setFilter = useUIStore((s) => s.setFilter);
  const toggleHideBought = useUIStore((s) => s.toggleHideBought);
  const setSearchTerm = useUIStore((s) => s.setSearchTerm);
  const activeModal = useUIStore((s) => s.activeModal);
  const openModal = useUIStore((s) => s.openModal);
  const closeModal = useUIStore((s) => s.closeModal);
  const priceHistoryProductId = useUIStore((s) => s.priceHistoryProductId);
  const setPriceHistoryProductId = useUIStore((s) => s.setPriceHistoryProductId);

  // Debounced search
  const debouncedSearch = useDebounce(searchTerm, 150);

  // Derived data structures
  const boughtMap = useMemo(() => {
    const map = new Map<number, BoughtItem>();
    for (const item of bought) {
      if (typeof item === 'object' && item.id !== undefined) {
        map.set(item.id, item);
      }
    }
    return map;
  }, [bought]);

  const boughtIds = useMemo(() => new Set(boughtMap.keys()), [boughtMap]);

  const selectedIds = useMemo(() => new Set(selectionArray), [selectionArray]);

  const priceHistoryCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const entry of priceHistory) {
      counts.set(entry.id, (counts.get(entry.id) ?? 0) + 1);
    }
    return counts;
  }, [priceHistory]);

  // Build render list: products + discontinued bought items
  const renderList = useMemo<RenderProduct[]>(() => {
    const list: RenderProduct[] = [...products];
    for (const [id, boughtItem] of boughtMap) {
      if (!products.find((p) => p.id === id)) {
        list.push({ ...boughtItem.product, _discontinued: true });
      }
    }
    return list;
  }, [products, boughtMap]);

  // Filter + sort
  const filteredProducts = useMemo(() => {
    let filtered = sortProducts(renderList);

    // Search (accent-insensitive)
    const term = normalize(debouncedSearch);
    if (term) {
      filtered = filtered.filter((p) => matchesSearch(p, term));
    }

    // Filter by tab
    if (filter === 'selected') {
      filtered = filtered.filter((p) => selectedIds.has(p.id));
    } else if (filter === 'bought') {
      filtered = filtered.filter((p) => boughtIds.has(p.id));
    } else if (filter === 'sale') {
      filtered = filtered.filter((p) => p.compareAtPrice != null && p.compareAtPrice > 0);
    }

    // Hide bought by default (except when in bought filter or searching)
    if (hideBought && filter === 'all' && !term) {
      filtered = filtered.filter((p) => !boughtIds.has(p.id));
    }

    return filtered;
  }, [renderList, debouncedSearch, filter, selectedIds, boughtIds, hideBought]);

  // Selected products (for bottom bar + order modal)
  const selectedProducts = useMemo(() => {
    return renderList.filter((p) => selectedIds.has(p.id));
  }, [renderList, selectedIds]);

  const selectedTotal = useMemo(
    () => selectedProducts.reduce((sum, p) => sum + p.price, 0),
    [selectedProducts],
  );

  const hasBoughtInSelection = useMemo(
    () => selectedProducts.some((p) => boughtIds.has(p.id)),
    [selectedProducts, boughtIds],
  );

  const boughtInSelection = useMemo(
    () => selectedProducts.filter((p) => boughtIds.has(p.id)),
    [selectedProducts, boughtIds],
  );

  // ── Actions ──────────────────────────────────────────────────

  const handleToggleSelect = useCallback(
    (id: number) => {
      const newSelection = new Set(selectedIds);
      if (newSelection.has(id)) {
        newSelection.delete(id);
      } else {
        newSelection.add(id);
      }
      updateSelection.mutate([...newSelection]);
    },
    [selectedIds, updateSelection],
  );

  const handleClearSelection = useCallback(() => {
    updateSelection.mutate([]);
  }, [updateSelection]);

  const handleOrder = useCallback(() => {
    openModal('order');
  }, [openModal]);

  const handleRemoveBought = useCallback(() => {
    openModal('removeBought');
  }, [openModal]);

  const handleShowPriceHistory = useCallback(
    (id: number) => {
      setPriceHistoryProductId(id);
      openModal('priceHistory');
    },
    [setPriceHistoryProductId, openModal],
  );

  // Confirm order — mark selected as bought, clear selection
  const handleConfirmOrder = useCallback(async () => {
    const now = new Date().toISOString();
    const newBoughtEntries: BoughtItem[] = selectedProducts.map((p) => ({
      id: p.id,
      boughtAt: now,
      product: {
        id: p.id,
        title: p.title,
        handle: p.handle,
        url: p.url,
        variantId: p.variantId,
        price: p.price,
        compareAtPrice: p.compareAtPrice,
        tags: p.tags,
        productType: p.productType,
        vendor: p.vendor,
        imageUrl: p.imageUrl,
        available: p.available,
      },
    }));

    // Merge with existing bought data (avoid duplicates)
    const existingIds = new Set(bought.map((b) => b.id));
    const merged = [...bought];
    for (const entry of newBoughtEntries) {
      if (!existingIds.has(entry.id)) {
        merged.push(entry);
      }
    }

    await updateBought.mutateAsync(merged);
    await updateSelection.mutateAsync([]);
  }, [selectedProducts, bought, updateBought, updateSelection]);

  // Confirm remove from bought
  const handleConfirmRemoveBought = useCallback(async () => {
    const toRemove = new Set(
      [...selectedIds].filter((id) => boughtIds.has(id)),
    );
    const newBought = bought.filter((b) => !toRemove.has(b.id));
    const newSelection = [...selectedIds].filter((id) => !toRemove.has(id));

    await updateBought.mutateAsync(newBought);
    await updateSelection.mutateAsync(newSelection);
  }, [selectedIds, boughtIds, bought, updateBought, updateSelection]);

  // Assemble cart
  const handleAssembleCart = useCallback(
    async (variantIds: number[]): Promise<OrderResponse> => {
      return await assembleCart.mutateAsync({ variantIds });
    },
    [assembleCart],
  );

  // Price history for selected product
  const { data: productPriceHistory = [] } = usePriceHistoryForProduct(priceHistoryProductId);
  const priceHistoryProduct = useMemo(() => {
    if (priceHistoryProductId == null) return null;
    return (
      products.find((p) => p.id === priceHistoryProductId) ||
      boughtMap.get(priceHistoryProductId)?.product ||
      null
    );
  }, [priceHistoryProductId, products, boughtMap]);

  return (
    <>
      <Header totalCount={products.length}>
        <SearchBar value={searchTerm} onChange={setSearchTerm} />
        <FilterBar
          currentFilter={filter}
          hideBought={hideBought}
          selectedCount={selectedIds.size}
          boughtCount={boughtIds.size}
          onFilterChange={setFilter}
          onToggleHideBought={toggleHideBought}
        />
      </Header>

      <ProductList
        products={filteredProducts}
        selectedIds={selectedIds}
        boughtMap={boughtMap}
        priceHistoryCounts={priceHistoryCounts}
        onToggleSelect={handleToggleSelect}
        onShowPriceHistory={handleShowPriceHistory}
        loading={productsLoading}
        error={productsError}
      />

      <BottomBar
        selectedCount={selectedIds.size}
        selectedTotal={selectedTotal}
        hasBoughtInSelection={hasBoughtInSelection}
        onClearSelection={handleClearSelection}
        onOrder={handleOrder}
        onRemoveBought={handleRemoveBought}
      />

      <OrderModal
        open={activeModal === 'order'}
        selectedProducts={selectedProducts}
        onClose={closeModal}
        onConfirm={handleConfirmOrder}
        onAssembleCart={handleAssembleCart}
      />

      <RemoveBoughtModal
        open={activeModal === 'removeBought'}
        boughtInSelection={boughtInSelection}
        onClose={closeModal}
        onConfirm={handleConfirmRemoveBought}
      />

      <PriceHistoryModal
        open={activeModal === 'priceHistory'}
        title={priceHistoryProduct?.title ?? 'Ismeretlen'}
        history={productPriceHistory}
        onClose={closeModal}
      />
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}