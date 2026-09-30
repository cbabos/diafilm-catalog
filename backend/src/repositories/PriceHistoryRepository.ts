import type { PriceHistoryEntry } from '../types.js';

export interface IPriceHistoryRepository {
  getAll(): Promise<PriceHistoryEntry[]>;
  saveAll(entries: PriceHistoryEntry[]): Promise<void>;
  getById(id: number): Promise<PriceHistoryEntry[]>;
  append(entry: PriceHistoryEntry): Promise<PriceHistoryEntry[]>;
}

import { JsonFileStore } from './JsonFileStore.js';

export class JsonPriceHistoryRepository implements IPriceHistoryRepository {
  private store: JsonFileStore;

  constructor(filePath: string) {
    this.store = new JsonFileStore(filePath);
  }

  async getAll(): Promise<PriceHistoryEntry[]> {
    return this.store.readOrDefault<PriceHistoryEntry[]>([]);
  }

  async saveAll(entries: PriceHistoryEntry[]): Promise<void> {
    this.store.write(entries);
  }

  async getById(id: number): Promise<PriceHistoryEntry[]> {
    const all = await this.getAll();
    return all.filter((e) => e.id === id);
  }

  async append(entry: PriceHistoryEntry): Promise<PriceHistoryEntry[]> {
    const all = await this.getAll();
    all.push(entry);
    await this.saveAll(all);
    return all;
  }

  ensureFile(): void {
    this.store.ensure([]);
  }
}