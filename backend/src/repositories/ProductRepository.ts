import type { Product } from '../types.js';

export interface IProductRepository {
  getAll(): Promise<Product[]>;
  saveAll(products: Product[]): Promise<void>;
  getById(id: number): Promise<Product | null>;
  getFileMtime(): Promise<number | null>;
}

import { JsonFileStore } from './JsonFileStore.js';
import { sortByTitle } from '../utils/normalize.js';

export class JsonProductRepository implements IProductRepository {
  private store: JsonFileStore;

  constructor(filePath: string) {
    this.store = new JsonFileStore(filePath);
  }

  async getAll(): Promise<Product[]> {
    return this.store.readOrDefault<Product[]>([]);
  }

  async saveAll(products: Product[]): Promise<void> {
    // Sort by Hungarian accent-insensitive title before saving
    const sorted = sortByTitle(products, (p) => p.title);
    this.store.write(sorted);
  }

  async getById(id: number): Promise<Product | null> {
    const all = await this.getAll();
    return all.find((p) => p.id === id) ?? null;
  }

  async getFileMtime(): Promise<number | null> {
    if (!this.store.exists()) return null;
    return this.store.mtime();
  }

  ensureFile(): void {
    this.store.ensure([]);
  }
}