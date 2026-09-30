import styles from './FilterBar.module.css';
import type { FilterType } from '../../types';

interface FilterBarProps {
  currentFilter: FilterType;
  hideBought: boolean;
  selectedCount: number;
  boughtCount: number;
  onFilterChange: (filter: FilterType) => void;
  onToggleHideBought: () => void;
}

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'Összes' },
  { key: 'sale', label: 'Akciós' },
  { key: 'selected', label: 'Kijelölt' },
  { key: 'bought', label: 'Megvett' },
];

export function FilterBar({
  currentFilter,
  hideBought,
  selectedCount,
  boughtCount,
  onFilterChange,
  onToggleHideBought,
}: FilterBarProps) {
  return (
    <div className={styles.filters}>
      {FILTERS.map((f) => (
        <button
          key={f.key}
          className={`${styles.filterBtn} ${currentFilter === f.key ? styles.active : ''}`}
          onClick={() => onFilterChange(f.key)}
        >
          {f.key === 'selected' && `Kijelölt (${selectedCount})`}
          {f.key === 'bought' && `Megvett (${boughtCount})`}
          {f.key === 'all' && 'Összes'}
          {f.key === 'sale' && 'Akciós'}
        </button>
      ))}
      <button
        className={`${styles.filterBtn} ${hideBought ? styles.active : ''}`}
        onClick={onToggleHideBought}
      >
        Elrejti vásároltakat
      </button>
    </div>
  );
}