import type { FastifyPluginCallback } from 'fastify';

export const priceHistoryRoutes: FastifyPluginCallback = (fastify, _opts, done) => {
  fastify.get('/api/price-history', async (_request, reply) => {
    const entries = await fastify.repos.priceHistory.getAll();
    reply.header('Cache-Control', 'no-cache');
    return entries;
  });

  fastify.get('/api/price-history/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const pid = parseInt(id, 10);

    if (isNaN(pid)) {
      return reply.code(400).send({ error: 'Product ID must be a number', code: 'BAD_INPUT' });
    }

    const entries = await fastify.repos.priceHistory.getById(pid);
    return entries;
  });

  done();
};