import type { DisappearedProduct } from '../types.js';

export interface IDisappearedRepository {
  getAll(): Promise<DisappearedProduct[]>;
  saveAll(items: DisappearedProduct[]): Promise<void>;
  add(item: DisappearedProduct): Promise<DisappearedProduct[]>;
  getById(id: number): Promise<DisappearedProduct | null>;
}

import { JsonFileStore } from './JsonFileStore.js';

export class JsonDisappearedRepository implements IDisappearedRepository {
  private store: JsonFileStore;

  constructor(filePath: string) {
    this.store = new JsonFileStore(filePath);
  }

  async getAll(): Promise<DisappearedProduct[]> {
    return this.store.readOrDefault<DisappearedProduct[]>([]);
  }

  async saveAll(items: DisappearedProduct[]): Promise<void> {
    this.store.write(items);
  }

  async add(item: DisappearedProduct): Promise<DisappearedProduct[]> {
    const all = await this.getAll();
    // Don't add duplicates
    if (!all.some((d) => d.id === item.id)) {
      all.push(item);
      await this.saveAll(all);
    }
    return all;
  }

  async getById(id: number): Promise<DisappearedProduct | null> {
    const all = await this.getAll();
    return all.find((d) => d.id === id) ?? null;
  }

  ensureFile(): void {
    this.store.ensure([]);
  }
}