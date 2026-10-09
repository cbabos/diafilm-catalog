import { useState } from 'react';
import styles from './FilterBar.module.css';
import type { FilterType, RenderProduct } from '../../types';
import { formatPrice, copyToClipboard } from '../../utils/format';

interface FilterBarProps {
  currentFilter: FilterType;
  hideBought: boolean;
  selectedCount: number;
  boughtCount: number;
  filteredProducts: RenderProduct[];
  onFilterChange: (filter: FilterType) => void;
  onToggleHideBought: () => void;
}

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'Összes' },
  { key: 'sale', label: 'Akciós' },
  { key: 'selected', label: 'Kijelölt' },
  { key: 'bought', label: 'Megvett' },
];

const FILTER_LABELS: Record<FilterType, string> = {
  all: 'Összes',
  sale: 'Akciós',
  selected: 'Kijelölt',
  bought: 'Megvett',
};

export function FilterBar({
  currentFilter,
  hideBought,
  selectedCount,
  boughtCount,
  filteredProducts,
  onFilterChange,
  onToggleHideBought,
}: FilterBarProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (filteredProducts.length === 0) return;

    const total = filteredProducts.reduce((sum, p) => sum + p.price, 0);
    const filterLabel = FILTER_LABELS[currentFilter];

    let text = `🎬 Diafilm lista — ${filterLabel}\n\n`;
    filteredProducts.forEach((p, i) => {
      const bought = p._discontinued ? ' (kifutott)' : '';
      text += `${i + 1}. ${p.title} — ${formatPrice(p.price)}${bought}\n`;
    });
    text += `\nÖsszesen: ${formatPrice(total)} (${filteredProducts.length} db)`;

    const success = await copyToClipboard(text);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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
      <button
        className={`${styles.copyBtn} ${copied ? styles.copied : ''}`}
        onClick={handleCopy}
        disabled={filteredProducts.length === 0}
        data-testid="copy-list-btn"
        title="Lista másolása vágólapra"
      >
        {copied ? '✅ Másolva!' : '📋 Lista másolása'}
      </button>
    </div>
  );
}