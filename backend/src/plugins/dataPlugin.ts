import type { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';
import path from 'node:path';
import { JsonProductRepository } from '../repositories/ProductRepository.js';
import { JsonBoughtRepository } from '../repositories/BoughtRepository.js';
import { JsonSelectionRepository } from '../repositories/SelectionRepository.js';
import { JsonPriceHistoryRepository } from '../repositories/PriceHistoryRepository.js';
import { JsonDisappearedRepository } from '../repositories/DisappearedRepository.js';

export interface DataPluginOptions {
  dataDir?: string;
}

export interface Repositories {
  products: JsonProductRepository;
  bought: JsonBoughtRepository;
  selection: JsonSelectionRepository;
  priceHistory: JsonPriceHistoryRepository;
  disappeared: JsonDisappearedRepository;
}

declare module 'fastify' {
  interface FastifyInstance {
    repos: Repositories;
  }
}

const dataPluginImpl: FastifyPluginCallback<DataPluginOptions> = (fastify, options, done) => {
  const dir = options.dataDir ?? process.cwd();

  const file = (name: string) => path.join(dir, name);

  const repos: Repositories = {
    products: new JsonProductRepository(file('products.json')),
    bought: new JsonBoughtRepository(file('bought.json')),
    selection: new JsonSelectionRepository(file('selected.json')),
    priceHistory: new JsonPriceHistoryRepository(file('price_history.json')),
    disappeared: new JsonDisappearedRepository(file('products_seen.json')),
  };

  // Ensure all data files exist on startup
  repos.products.ensureFile();
  repos.bought.ensureFile();
  repos.selection.ensureFile();
  repos.priceHistory.ensureFile();
  repos.disappeared.ensureFile();

  fastify.decorate('repos', repos);
  done();
};

// Wrap with fp to break encapsulation — so repos is available to all route plugins
export const dataPlugin = fp(dataPluginImpl);