/** Special product ID for the projector — always pinned to top */
export const PROJECTOR_ID = 8462548992273;

/**
 * Hungarian accent-insensitive normalization.
 * Uses NFD decomposition then strips combining diacritical marks.
 * á → a, é → e, ö → o, ő → o, ü → u, ű → u, etc.
 */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Check if a product matches a search term (accent-insensitive).
 * Matches against title and tags.
 */
export function matchesSearch(product: { title: string; tags: string[] }, term: string): boolean {
  const normalizedTerm = normalize(term);
  if (!normalizedTerm) return true;
  return (
    normalize(product.title).includes(normalizedTerm) ||
    (product.tags || []).some((t) => normalize(t).includes(normalizedTerm))
  );
}