export interface INotInterestedRepository {
  getAll(): Promise<number[]>;
  saveAll(ids: number[]): Promise<void>;
  has(id: number): Promise<boolean>;
}

import { JsonFileStore } from './JsonFileStore.js';

export class JsonNotInterestedRepository implements INotInterestedRepository {
  private store: JsonFileStore;

  constructor(filePath: string) {
    this.store = new JsonFileStore(filePath);
  }

  async getAll(): Promise<number[]> {
    return this.store.readOrDefault<number[]>([]);
  }

  async saveAll(ids: number[]): Promise<void> {
    // Deduplicate
    const unique = [...new Set(ids)];
    this.store.write(unique);
  }

  async has(id: number): Promise<boolean> {
    const all = await this.getAll();
    return all.includes(id);
  }

  ensureFile(): void {
    this.store.ensure([]);
  }
}