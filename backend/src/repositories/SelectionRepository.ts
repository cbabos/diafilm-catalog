export interface ISelectionRepository {
  getAll(): Promise<number[]>;
  saveAll(ids: number[]): Promise<void>;
  add(id: number): Promise<number[]>;
  remove(id: number): Promise<number[]>;
  toggle(id: number): Promise<number[]>;
}

import { JsonFileStore } from './JsonFileStore.js';

export class JsonSelectionRepository implements ISelectionRepository {
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

  async add(id: number): Promise<number[]> {
    const all = await this.getAll();
    if (!all.includes(id)) {
      all.push(id);
      await this.saveAll(all);
    }
    return all;
  }

  async remove(id: number): Promise<number[]> {
    const all = await this.getAll();
    const filtered = all.filter((i) => i !== id);
    await this.saveAll(filtered);
    return filtered;
  }

  async toggle(id: number): Promise<number[]> {
    const all = await this.getAll();
    if (all.includes(id)) {
      return this.remove(id);
    }
    return this.add(id);
  }

  ensureFile(): void {
    this.store.ensure([]);
  }
}