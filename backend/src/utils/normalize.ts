// Hungarian accent-insensitive normalization for sorting.
// Removes diacritics (á→a, ö→o, ő→o, ü→u, ű→u, etc.) and lowercases.

/**
 * Normalize a string for Hungarian accent-insensitive comparison.
 * Uses NFD decomposition and strips combining marks (Mn category),
 * matching the Python unicodedata approach.
 */
export function normalize(s: string): string {
  const lower = s.toLowerCase();
  // NFD decomposition separates base chars from combining marks
  const decomposed = lower.normalize('NFD');
  // Remove combining marks (category "Mn" = Mark, Nonspacing)
  return decomposed.replace(/\p{Mn}/gu, '');
}

/**
 * Compare two strings using Hungarian accent-insensitive normalization.
 * Returns negative if a < b, 0 if equal, positive if a > b.
 */
export function compareHungarian(a: string, b: string): number {
  return normalize(a).localeCompare(normalize(b));
}

/**
 * Sort an array of objects by a title-like field using Hungarian normalization.
 * Returns a new sorted array (does not mutate input).
 */
export function sortByTitle<T>(items: T[], getTitle: (item: T) => string): T[] {
  return [...items].sort((a, b) => compareHungarian(getTitle(a), getTitle(b)));
}