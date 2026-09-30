import { Modal } from '../Modal/Modal';
import styles from './RemoveBoughtModal.module.css';
import type { Product } from '../../types';

interface RemoveBoughtModalProps {
  open: boolean;
  boughtInSelection: Product[];
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function RemoveBoughtModal({
  open,
  boughtInSelection,
  onClose,
  onConfirm,
}: RemoveBoughtModalProps) {
  const handleConfirm = async () => {
    await onConfirm();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="↩ Gyűjteményből eltávolítás">
      <div className={styles.summary}>
        {boughtInSelection.length} diafilm eltávolítása a gyűjteményből
      </div>
      <div className={styles.list}>
        {boughtInSelection.map((p) => (
          <div key={p.id} className={styles.listItem}>
            <span>{p.title}</span>
            <span className={styles.bought}>✓ megvásárolva</span>
          </div>
        ))}
      </div>
      <div className={styles.btnGroup} style={{ marginTop: 12 }}>
        <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={onClose}>
          Mégse
        </button>
        <button
          className={`${styles.btn} ${styles.btnRemove}`}
          onClick={handleConfirm}
          data-testid="confirm-remove-btn"
        >
          Eltávolítom
        </button>
      </div>
    </Modal>
  );
}