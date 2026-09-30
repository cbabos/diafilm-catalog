import styles from './ProductList.module.css';
import { ProductCard } from '../ProductCard/ProductCard';
import type { Product, BoughtInfo } from '../../types';

interface ProductListProps {
  products: Product[];
  selectedIds: Set<number>;
  boughtMap: Map<number, { boughtAt: string; product: Product }>;
  priceHistoryCounts: Map<number, number>;
  onToggleSelect: (id: number) => void;
  onShowPriceHistory: (id: number) => void;
  loading?: boolean;
  error?: Error | null;
}

export function ProductList({
  products,
  selectedIds,
  boughtMap,
  priceHistoryCounts,
  onToggleSelect,
  onShowPriceHistory,
  loading,
  error,
}: ProductListProps) {
  if (loading) {
    return <div className={styles.loading}>Betöltés...</div>;
  }

  if (error) {
    return <div className={styles.loading}>Hiba: {error.message}</div>;
  }

  if (products.length === 0) {
    return <div className={styles.emptyState}>Nincs találat 🎞️</div>;
  }

  return (
    <div className={styles.products}>
      {products.map((product) => {
        const boughtEntry = boughtMap.get(product.id);
        const boughtInfo: BoughtInfo | null = boughtEntry
          ? { pricePaid: boughtEntry.product.price, date: boughtEntry.boughtAt }
          : null;

        return (
          <ProductCard
            key={product.id}
            product={product}
            isSelected={selectedIds.has(product.id)}
            isBought={boughtMap.has(product.id)}
            boughtInfo={boughtInfo}
            priceHistoryCount={priceHistoryCounts.get(product.id) ?? 0}
            onToggleSelect={onToggleSelect}
            onShowPriceHistory={onShowPriceHistory}
          />
        );
      })}
    </div>
  );
}