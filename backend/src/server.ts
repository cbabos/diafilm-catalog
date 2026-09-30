import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { dataPlugin, type DataPluginOptions } from './plugins/dataPlugin.js';
import { productsRoutes } from './routes/products.js';
import { boughtRoutes } from './routes/bought.js';
import { selectionRoutes } from './routes/selection.js';
import { priceHistoryRoutes } from './routes/priceHistory.js';
import { disappearedRoutes } from './routes/disappeared.js';
import { orderRoutes } from './routes/order.js';
import { healthRoutes } from './routes/health.js';

export interface ServerOptions extends DataPluginOptions {
  logger?: boolean;
}

export async function buildServer(options: ServerOptions = {}): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: options.logger ?? false,
  });

  // CORS — allow frontend to call from different origin
  await fastify.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'OPTIONS'],
  });

  // Data plugin — registers repositories
  await fastify.register(dataPlugin, { dataDir: options.dataDir });

  // Routes
  await fastify.register(productsRoutes);
  await fastify.register(boughtRoutes);
  await fastify.register(selectionRoutes);
  await fastify.register(priceHistoryRoutes);
  await fastify.register(disappearedRoutes);
  await fastify.register(orderRoutes);
  await fastify.register(healthRoutes);

  // Error handler — consistent error shape
  fastify.setErrorHandler((error: Error & { statusCode?: number; code?: string }, _request, reply) => {
    const statusCode = error.statusCode ?? 500;
    const message = error.message ?? 'Internal server error';
    const code = statusCode >= 400 && statusCode < 500 ? error.code : undefined;
    reply.code(statusCode).send({
      error: message,
      ...(code ? { code } : {}),
    });
  });

  // 404 handler
  fastify.setNotFoundHandler((request, reply) => {
    reply.code(404).send({ error: `Route not found: ${request.method} ${request.url}`, code: 'NOT_FOUND' });
  });

  return fastify;
}