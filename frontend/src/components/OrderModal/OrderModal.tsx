import { useState } from 'react';
import { Modal } from '../Modal/Modal';
import styles from './OrderModal.module.css';
import type { Product, OrderResponse } from '../../types';
import { formatPrice, copyToClipboard } from '../../utils/format';

interface OrderModalProps {
  open: boolean;
  selectedProducts: Product[];
  onClose: () => void;
  onConfirm: () => Promise<void>;
  onAssembleCart: (variantIds: number[]) => Promise<OrderResponse>;
}

type Step = 'assemble' | 'checkout' | 'confirmed';

export function OrderModal({
  open,
  selectedProducts,
  onClose,
  onConfirm,
  onAssembleCart,
}: OrderModalProps) {
  const [step, setStep] = useState<Step>('assemble');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const total = selectedProducts.reduce((sum, p) => sum + p.price, 0);

  const handleAssemble = async () => {
    const variantIds = selectedProducts.map((p) => p.variantId).filter(Boolean);
    if (variantIds.length === 0) {
      setError('Nincsenek rendelhető tételek!');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await onAssembleCart(variantIds);
      if (result.ok) {
        setCheckoutUrl(result.checkoutUrl);
        setStep('checkout');
      } else {
        setError('Hiba a kosár összeállításakor');
      }
    } catch (e) {
      setError(`Hiba: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    await onConfirm();
    setStep('confirmed');
  };

  const handleCancel = () => {
    // Selection preserved — just close
    setStep('assemble');
    setError(null);
    setCheckoutUrl('');
    onClose();
  };

  const handleClose = () => {
    setStep('assemble');
    setError(null);
    setCheckoutUrl('');
    setCopied(false);
    onClose();
  };

  const handleCopy = async () => {
    let text = '🎬 Diafilm rendelés\n\n';
    selectedProducts.forEach((p, i) => {
      text += `${i + 1}. ${p.title} — ${formatPrice(p.price)}\n`;
    });
    text += `\nÖsszesen: ${formatPrice(total)} (${selectedProducts.length} db)`;

    const success = await copyToClipboard(text);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="🛒 Rendelés összesítő">
      <div className={styles.summary}>
        {selectedProducts.length} diafilm · Összesen {formatPrice(total)}
      </div>

      <div className={styles.orderList}>
        {selectedProducts.map((p) => (
          <div key={p.id} className={styles.orderListItem}>
            <span>{p.title}</span>
            <span className={styles.price}>{formatPrice(p.price)}</span>
          </div>
        ))}
      </div>

      {step === 'assemble' && (
        <div data-testid="step-assemble">
          {error && <div className={styles.errorBox}>{error}</div>}
          {loading && (
            <div className={styles.loadingBox}>
              <div className={styles.spinner} />
              <p className={styles.loadingText}>Kosár összeállítása...</p>
            </div>
          )}
          {!loading && (
            <div className={styles.btnGroup}>
              <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={handleClose}>
                Mégse
              </button>
              <button
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={handleCopy}
                data-testid="copy-btn"
              >
                {copied ? '✅ Másolva!' : '📋 Másolás'}
              </button>
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={handleAssemble}
                style={{ flex: 2 }}
                data-testid="assemble-btn"
              >
                Kosárba teszem
              </button>
            </div>
          )}
        </div>
      )}

      {step === 'checkout' && (
        <div data-testid="step-checkout">
          <div className={styles.successBox}>
            <p>✅ Kosár összeállítva a diafilm.hu-n!</p>
            <p className={styles.hint}>
              Nyisd meg a pénztárt, fizess, majd erősítsd meg lent.
            </p>
            <a
              href={checkoutUrl}
              className={styles.checkoutLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              Pénztár megnyitása →
            </a>
          </div>
          <div className={styles.btnGroup} style={{ marginTop: 12 }}>
            <button
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={handleCancel}
            >
              ↩ Mégse, nem rendelek
            </button>
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={handleConfirm}
              data-testid="confirm-btn"
            >
              ✓ Megrendeltem
            </button>
          </div>
        </div>
      )}

      {step === 'confirmed' && (
        <div data-testid="step-confirmed">
          <div className={styles.successBox}>
            <p>✅ Rendelés rögzítva! Kijelölt tételek megvásároltként jelölve.</p>
          </div>
          <div className={styles.btnGroup} style={{ marginTop: 12 }}>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleClose}>
              Kész
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}