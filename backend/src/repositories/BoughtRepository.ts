import type { BoughtItem } from '../types.js';

export interface IBoughtRepository {
  getAll(): Promise<BoughtItem[]>;
  saveAll(items: BoughtItem[]): Promise<void>;
  add(item: BoughtItem): Promise<BoughtItem[]>;
  remove(id: number): Promise<BoughtItem[]>;
  isLegacyFormat(): Promise<boolean>;
  readRaw(): unknown[];
}

import { JsonFileStore } from './JsonFileStore.js';

export class JsonBoughtRepository implements IBoughtRepository {
  private store: JsonFileStore;

  constructor(filePath: string) {
    this.store = new JsonFileStore(filePath);
  }

  async getAll(): Promise<BoughtItem[]> {
    return this.store.readOrDefault<BoughtItem[]>([]);
  }

  async saveAll(items: BoughtItem[]): Promise<void> {
    this.store.write(items);
  }

  async add(item: BoughtItem): Promise<BoughtItem[]> {
    const all = await this.getAll();
    // Remove any existing entry with the same product ID, then prepend
    const filtered = all.filter((i) => i.id !== item.id);
    filtered.unshift(item);
    await this.saveAll(filtered);
    return filtered;
  }

  async remove(id: number): Promise<BoughtItem[]> {
    const all = await this.getAll();
    const filtered = all.filter((i) => i.id !== id);
    await this.saveAll(filtered);
    return filtered;
  }

  /**
   * Check if the bought.json contains legacy bare IDs (numbers)
   * vs enriched objects with `boughtAt` field.
   */
  async isLegacyFormat(): Promise<boolean> {
    const raw = this.readRaw();
    if (raw.length === 0) return false;
    const first = raw[0];
    // Legacy format: bare number
    if (typeof first === 'number') return true;
    // Already enriched: object with boughtAt
    if (typeof first === 'object' && first !== null && 'boughtAt' in first) return false;
    // Partially enriched without boughtAt — treat as legacy
    return true;
  }

  /** Read raw data for migration (may contain numbers) */
  readRaw(): unknown[] {
    return this.store.readOrDefault<unknown[]>([]);
  }

  ensureFile(): void {
    this.store.ensure([]);
  }
}