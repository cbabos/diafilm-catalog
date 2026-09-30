import styles from './ProductCard.module.css';
import type { Product, BoughtInfo } from '../../types';
import { formatPrice, formatDate, discountPercent } from '../../utils/format';

interface ProductCardProps {
  product: Product;
  isSelected: boolean;
  isBought: boolean;
  boughtInfo?: BoughtInfo | null;
  priceHistoryCount: number;
  onToggleSelect: (id: number) => void;
  onShowPriceHistory: (id: number) => void;
}

export function ProductCard({
  product,
  isSelected,
  isBought,
  boughtInfo,
  priceHistoryCount,
  onToggleSelect,
  onShowPriceHistory,
}: ProductCardProps) {
  const onSale = product.compareAtPrice != null && product.compareAtPrice > 0;
  const discontinued = (product as Product & { _discontinued?: boolean })._discontinued === true;

  const cardClasses = [
    styles.productCard,
    isSelected ? styles.selected : '',
    isBought ? styles.bought : '',
    onSale ? styles.onSale : '',
  ]
    .filter(Boolean)
    .join(' ');

  // Price change indicator for bought items
  let priceDiff = null;
  if (isBought && boughtInfo && !discontinued && boughtInfo.pricePaid !== product.price) {
    const diff = product.price - boughtInfo.pricePaid;
    const arrow = diff < 0 ? '↓' : '↑';
    const color = diff < 0 ? 'var(--red)' : 'var(--green)';
    priceDiff = (
      <span className={styles.priceDiff} style={{ color }}>
        {' '}
        · Most: {formatPrice(product.price)} {arrow}
      </span>
    );
  }

  return (
    <div className={cardClasses} data-testid="product-card">
      <div
        className={`${styles.selectBox} ${isSelected ? styles.checked : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelect(product.id);
        }}
        role="checkbox"
        aria-checked={isSelected}
        tabIndex={0}
        data-testid="select-box"
      />

      {discontinued ? (
        <div className={styles.productLink}>
          <img
            className={styles.productImg}
            src={product.imageUrl || ''}
            alt={product.title}
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <div className={styles.productInfo}>
            <div className={styles.productTitle}>
              {product.title}
              <span className={styles.discontinuedBadge}>Nem elérhető</span>
              {priceHistoryCount > 1 && (
                <span
                  className={styles.historyIcon}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onShowPriceHistory(product.id);
                  }}
                  title="Ártörténet"
                  data-testid="history-icon"
                >
                  📈
                </span>
              )}
            </div>
            <div className={styles.productMeta}>
              <span className={styles.productPrice}>{formatPrice(product.price)}</span>
            </div>
            {isBought && boughtInfo && (
              <div className={styles.boughtInfo}>
                ✓ {formatPrice(boughtInfo.pricePaid)}
                {boughtInfo.date ? ` (${formatDate(boughtInfo.date)})` : ''}
                {priceDiff}
              </div>
            )}
            {product.tags && product.tags.length > 0 && (
              <div className={styles.productTags}>{product.tags.slice(0, 4).join(' · ')}</div>
            )}
          </div>
        </div>
      ) : (
        <a
          className={styles.productLink}
          href={product.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            className={styles.productImg}
            src={product.imageUrl || ''}
            alt={product.title}
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <div className={styles.productInfo}>
            <div className={styles.productTitle}>
              {product.title}
              {onSale && <span className={styles.saleBadge}>Akció</span>}
              {priceHistoryCount > 1 && (
                <span
                  className={styles.historyIcon}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onShowPriceHistory(product.id);
                  }}
                  title="Ártörténet"
                  data-testid="history-icon"
                >
                  📈
                </span>
              )}
            </div>
            <div className={styles.productMeta}>
              {onSale ? (
                <>
                  <span className={`${styles.productPrice} ${styles.compare}`}>
                    {formatPrice(product.compareAtPrice!)}
                  </span>
                  <span className={styles.productPrice}>{formatPrice(product.price)}</span>
                  <span className={styles.discount}>
                    -{discountPercent(product.price, product.compareAtPrice!)}%
                  </span>
                </>
              ) : (
                <span className={styles.productPrice}>{formatPrice(product.price)}</span>
              )}
            </div>
            {isBought && boughtInfo && (
              <div className={styles.boughtInfo}>
                ✓ {formatPrice(boughtInfo.pricePaid)}
                {boughtInfo.date ? ` (${formatDate(boughtInfo.date)})` : ''}
                {priceDiff}
              </div>
            )}
            {product.tags && product.tags.length > 0 && (
              <div className={styles.productTags}>{product.tags.slice(0, 4).join(' · ')}</div>
            )}
          </div>
        </a>
      )}
    </div>
  );
}