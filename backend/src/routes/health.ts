import type { FastifyPluginCallback } from 'fastify';

const startTime = Date.now();

export const healthRoutes: FastifyPluginCallback = (fastify, _opts, done) => {
  fastify.get('/api/health', async () => {
    const products = await fastify.repos.products.getAll();
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    return {
      status: 'ok',
      products: products.length,
      uptime,
    };
  });

  done();
};