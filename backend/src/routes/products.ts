import type { FastifyInstance, FastifyPluginCallback } from 'fastify';

export const productsRoutes: FastifyPluginCallback = (fastify, _opts, done) => {
  fastify.get('/api/products', async (_request, reply) => {
    const products = await fastify.repos.products.getAll();
    reply.header('Cache-Control', 'no-cache');
    return products;
  });

  done();
};