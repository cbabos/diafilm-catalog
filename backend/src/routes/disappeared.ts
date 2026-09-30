import type { FastifyPluginCallback } from 'fastify';

export const disappearedRoutes: FastifyPluginCallback = (fastify, _opts, done) => {
  fastify.get('/api/disappeared', async (_request, reply) => {
    const items = await fastify.repos.disappeared.getAll();
    reply.header('Cache-Control', 'no-cache');
    return items;
  });

  done();
};