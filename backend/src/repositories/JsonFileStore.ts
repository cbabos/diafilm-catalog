import fs from 'node:fs';
import path from 'node:path';

/**
 * Low-level JSON file read/write helper.
 * All JSON repositories delegate to this for atomic file I/O.
 */
export class JsonFileStore {
  constructor(private filePath: string) {}

  exists(): boolean {
    return fs.existsSync(this.filePath);
  }

  mtime(): number {
    return fs.statSync(this.filePath).mtimeMs;
  }

  read<T>(): T {
    const raw = fs.readFileSync(this.filePath, 'utf-8');
    return JSON.parse(raw) as T;
  }

  readOrDefault<T>(defaultValue: T): T {
    if (!this.exists()) return defaultValue;
    try {
      return this.read<T>();
    } catch {
      return defaultValue;
    }
  }

  write<T>(data: T): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    // Write atomically: write to temp file then rename
    const tmp = `${this.filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmp, this.filePath);
  }

  ensure(defaultValue: unknown): void {
    if (!this.exists()) {
      this.write(defaultValue);
    }
  }
}