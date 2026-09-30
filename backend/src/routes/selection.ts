import type { FastifyPluginCallback } from 'fastify';

export const selectionRoutes: FastifyPluginCallback = (fastify, _opts, done) => {
  fastify.get('/api/selection', async (_request, reply) => {
    const ids = await fastify.repos.selection.getAll();
    reply.header('Cache-Control', 'no-cache');
    return ids;
  });

  fastify.post('/api/selection', async (request, reply) => {
    const body = request.body;

    if (!Array.isArray(body)) {
      return reply.code(400).send({ error: 'Expected an array of numbers', code: 'BAD_INPUT' });
    }

    // Validate all elements are numbers
    for (const id of body) {
      if (typeof id !== 'number') {
        return reply.code(400).send({ error: 'All selection IDs must be numbers', code: 'BAD_INPUT' });
      }
    }

    const ids = body as number[];
    await fastify.repos.selection.saveAll(ids);
    return { ok: true, count: ids.length };
  });

  done();
};