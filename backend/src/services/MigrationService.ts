import type { BoughtItem, Product, DisappearedProduct } from '../types.js';
import type { IBoughtRepository } from '../repositories/BoughtRepository.js';
import type { IProductRepository } from '../repositories/ProductRepository.js';
import type { IDisappearedRepository } from '../repositories/DisappearedRepository.js';

export class MigrationService {
  constructor(
    private boughtRepo: IBoughtRepository,
    private productRepo: IProductRepository,
    private disappearedRepo: IDisappearedRepository,
  ) {}

  /**
   * On startup, check if bought.json contains bare IDs (numbers) vs enriched (objects with `boughtAt`).
   * If bare IDs: cross-reference with products.json, build snapshots, save enriched format.
   * If product not found: check disappeared list, or use stub.
   */
  async migrateIfNeeded(): Promise<{ migrated: boolean; count: number }> {
    const isLegacy = await this.boughtRepo.isLegacyFormat();
    if (!isLegacy) {
      return { migrated: false, count: 0 };
    }

    // Read raw data (may contain bare numbers)
    const raw = this.boughtRepo.readRaw();
    if (raw.length === 0) {
      return { migrated: false, count: 0 };
    }

    const products = await this.productRepo.getAll();
    const prodMap = new Map(products.map((p) => [p.id, p]));

    const disappeared = await this.disappearedRepo.getAll();
    const disMap = new Map(disappeared.map((d) => [d.id, d]));

    const now = new Date().toISOString();
    const enriched: BoughtItem[] = [];

    for (const item of raw) {
      // Already partially enriched (object with boughtAt) — keep as-is
      if (typeof item === 'object' && item !== null && 'boughtAt' in item) {
        enriched.push(item as BoughtItem);
        continue;
      }

      // Bare ID — migrate
      if (typeof item !== 'number') {
        // Unknown format, skip
        continue;
      }

      const pid = item;
      const prod = prodMap.get(pid);
      let snapshot: Product;

      if (prod) {
        // Full snapshot from current product data
        snapshot = { ...prod };
      } else {
        const d = disMap.get(pid);
        if (d) {
          snapshot = {
            id: pid,
            title: d.title,
            handle: '',
            url: '',
            variantId: 0,
            price: d.lastPrice,
            compareAtPrice: null,
            available: false,
            tags: [],
            productType: '',
            vendor: 'Diafilm',
            imageUrl: null,
          };
        } else {
          // Stub for unknown product
          snapshot = {
            id: pid,
            title: 'Ismeretlen (törölve)',
            handle: '',
            url: '',
            variantId: 0,
            price: 0,
            compareAtPrice: null,
            available: false,
            tags: [],
            productType: '',
            vendor: '',
            imageUrl: null,
          };
        }
      }

      enriched.push({ id: pid, boughtAt: now, product: snapshot });
    }

    await this.boughtRepo.saveAll(enriched);
    return { migrated: true, count: enriched.length };
  }
}