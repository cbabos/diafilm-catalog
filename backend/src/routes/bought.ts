import type { FastifyInstance, FastifyPluginCallback } from 'fastify';
import type { BoughtItem } from '../types.js';

export const boughtRoutes: FastifyPluginCallback = (fastify, _opts, done) => {
  fastify.get('/api/bought', async (_request, reply) => {
    const items = await fastify.repos.bought.getAll();
    reply.header('Cache-Control', 'no-cache');
    return items;
  });

  fastify.post('/api/bought', async (request, reply) => {
    const body = request.body;

    if (!Array.isArray(body)) {
      return reply.code(400).send({ error: 'Expected an array of BoughtItem', code: 'BAD_INPUT' });
    }

    // Basic validation — each item must have id and boughtAt
    for (const item of body) {
      if (typeof item !== 'object' || item === null || typeof item.id !== 'number' || typeof item.boughtAt !== 'string') {
        return reply.code(400).send({ error: 'Each item must have { id: number, boughtAt: string, product: Product }', code: 'BAD_INPUT' });
      }
    }

    const items = body as BoughtItem[];
    await fastify.repos.bought.saveAll(items);
    return { ok: true, count: items.length };
  });

  done();
};