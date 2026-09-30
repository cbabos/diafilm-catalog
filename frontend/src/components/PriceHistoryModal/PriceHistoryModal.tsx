import { Modal } from '../Modal/Modal';
import styles from './PriceHistoryModal.module.css';
import type { PriceHistoryEntry } from '../../types';
import { formatPrice } from '../../utils/format';

interface PriceHistoryModalProps {
  open: boolean;
  title: string;
  history: PriceHistoryEntry[];
  onClose: () => void;
}

export function PriceHistoryModal({ open, title, history, onClose }: PriceHistoryModalProps) {
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <Modal open={open} onClose={onClose} title="📈 Ártörténet">
      <div className={styles.title}>
        <strong>{title}</strong>
      </div>
      <div className={styles.list}>
        {sorted.map((entry, i) => (
          <div key={i} className={styles.listItem}>
            <span>
              {entry.date}
              {entry.compareAtPrice && <span className={styles.saleBadge}>akció</span>}
            </span>
            <span className={styles.price}>
              {formatPrice(entry.price)}
              {entry.compareAtPrice && ` (volt: ${formatPrice(entry.compareAtPrice)})`}
            </span>
          </div>
        ))}
      </div>
      <div className={styles.btnGroup} style={{ marginTop: 12 }}>
        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={onClose}>
          Bezárás
        </button>
      </div>
    </Modal>
  );
}