import { buildServer } from './server.js';
import { config } from './config.js';
import { ScraperService } from './services/ScraperService.js';
import { MigrationService } from './services/MigrationService.js';
import { JsonProductRepository } from './repositories/ProductRepository.js';
import { JsonBoughtRepository } from './repositories/BoughtRepository.js';
import { JsonPriceHistoryRepository } from './repositories/PriceHistoryRepository.js';
import { JsonDisappearedRepository } from './repositories/DisappearedRepository.js';
import { dataFilePath } from './config.js';

async function main() {
  // Pre-startup: ensure data files exist, run scraper + migration

  // Create repos directly for startup logic
  const productRepo = new JsonProductRepository(dataFilePath('products.json'));
  const boughtRepo = new JsonBoughtRepository(dataFilePath('bought.json'));
  const priceHistoryRepo = new JsonPriceHistoryRepository(dataFilePath('price_history.json'));
  const disappearedRepo = new JsonDisappearedRepository(dataFilePath('products_seen.json'));

  productRepo.ensureFile();
  boughtRepo.ensureFile();
  priceHistoryRepo.ensureFile();
  disappearedRepo.ensureFile();

  // Run scraper (auto-rescrape if >24h)
  const scraper = new ScraperService(productRepo, priceHistoryRepo, disappearedRepo);
  try {
    const result = await scraper.maybeRescrape();
    if (result.scraped) {
      console.log(`📦 Scraped ${result.productCount} products.`);
      if (result.priceChanges > 0) {
        console.log(`📈 ${result.priceChanges} price change(s) logged.`);
      }
      if (result.disappearedCount > 0) {
        console.log(`👻 ${result.disappearedCount} product(s) disappeared.`);
      }
    } else {
      console.log(`📦 products.json is fresh enough (${result.productCount} products).`);
    }
  } catch (err) {
    console.error(`⚠️ Re-scrape failed (${err}), using existing data.`);
  }

  // Run migration (legacy bare-ID → enriched)
  const migration = new MigrationService(boughtRepo, productRepo, disappearedRepo);
  try {
    const result = await migration.migrateIfNeeded();
    if (result.migrated) {
      console.log(`🔄 Migrated ${result.count} bought item(s).`);
    }
  } catch (err) {
    console.error(`⚠️ Migration failed: ${err}`);
  }

  // Build and start server
  const fastify = await buildServer({ logger: true, dataDir: config.dataDir });

  try {
    await fastify.listen({ port: config.port, host: config.host });
    console.log(`📡 Diafilm backend running on http://${config.host}:${config.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();