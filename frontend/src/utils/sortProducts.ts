import { normalize } from './normalize';
import { PROJECTOR_ID } from '../utils/normalize';
import type { Product } from '../types';

/**
 * Sort products: Device (projector) first → On Sale → Alphabetical (Hungarian locale)
 */
export function sortProducts<T extends Product>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    // 1. Projector pinned to top
    const aProj = a.id === PROJECTOR_ID ? 0 : 1;
    const bProj = b.id === PROJECTOR_ID ? 0 : 1;
    if (aProj !== bProj) return aProj - bProj;

    // 2. On sale items before non-sale
    const aSale = a.compareAtPrice != null && a.compareAtPrice > 0 ? 0 : 1;
    const bSale = b.compareAtPrice != null && b.compareAtPrice > 0 ? 0 : 1;
    if (aSale !== bSale) return aSale - bSale;

    // 3. Alphabetical by title (Hungarian locale, accent-insensitive)
    return normalize(a.title).localeCompare(normalize(b.title), 'hu');
  });
}