import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Project root is two levels up from src/config.ts → backend/
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

export const config = {
  port: parseInt(process.env.PORT ?? '3001', 10),
  host: process.env.HOST ?? '0.0.0.0',
  dataDir: process.env.DATA_DIR ?? PROJECT_ROOT,
  rescrapeMaxAgeSeconds: parseInt(process.env.RESCRAPE_MAX_AGE ?? '86400', 10), // 24h
  shopifyBase: process.env.SHOPIFY_BASE_URL ?? 'https://diafilm.hu',
  userAgent:
    process.env.USER_AGENT ??
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  // Special product IDs
  projectorId: 8462548992273,
} as const;

export function dataFilePath(filename: string): string {
  return path.join(config.dataDir, filename);
}