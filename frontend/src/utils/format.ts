/** Format a price in HUF using Hungarian locale */
export function formatPrice(price: number): string {
  return `${price.toLocaleString('hu')} Ft`;
}

/** Format a date string (ISO) to Hungarian locale date */
export function formatDate(iso: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('hu-HU');
}

/** Calculate discount percentage from sale price and compare-at price */
export function discountPercent(price: number, compareAtPrice: number): number {
  return Math.round((1 - price / compareAtPrice) * 100);
}

/** Copy text to clipboard with fallback for non-secure contexts */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.ClipboardItem) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to fallback
  }

  // Fallback for HTTP (non-secure context)
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return true;
  } catch {
    return false;
  }
}