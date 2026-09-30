import styles from './BottomBar.module.css';
import { formatPrice } from '../../utils/format';

interface BottomBarProps {
  selectedCount: number;
  selectedTotal: number;
  hasBoughtInSelection: boolean;
  onClearSelection: () => void;
  onOrder: () => void;
  onRemoveBought: () => void;
}

export function BottomBar({
  selectedCount,
  selectedTotal,
  hasBoughtInSelection,
  onClearSelection,
  onOrder,
  onRemoveBought,
}: BottomBarProps) {
  return (
    <div className={styles.bottomBar}>
      <div className={styles.selectionInfo}>
        <span className={styles.num}>{selectedCount}</span> kijelölve ·{' '}
        <span className={styles.total}>{formatPrice(selectedTotal)}</span>
      </div>
      <button
        className={`${styles.btn} ${styles.btnSecondary}`}
        onClick={onClearSelection}
        disabled={selectedCount === 0}
      >
        Törlés
      </button>
      {hasBoughtInSelection && (
        <button
          className={`${styles.btn} ${styles.btnRemove}`}
          onClick={onRemoveBought}
          data-testid="remove-bought-btn"
        >
          Eltávolít
        </button>
      )}
      <button
        className={`${styles.btn} ${styles.btnPrimary}`}
        onClick={onOrder}
        disabled={selectedCount === 0}
        data-testid="order-btn"
      >
        Rendelés
      </button>
    </div>
  );
}