import type { FastifyPluginCallback } from 'fastify';
import { CartService } from '../services/CartService.js';
import type { OrderRequest } from '../types.js';

export const orderRoutes: FastifyPluginCallback = (fastify, _opts, done) => {
  fastify.post('/api/order', async (request, reply) => {
    const body = request.body as Partial<OrderRequest>;

    if (!body || !Array.isArray(body.variantIds) || body.variantIds.length === 0) {
      return reply.code(400).send({ error: 'No items selected', code: 'NO_ITEMS' });
    }

    // Validate all variant IDs are numbers
    for (const vid of body.variantIds) {
      if (typeof vid !== 'number') {
        return reply.code(400).send({ error: 'All variantIds must be numbers', code: 'BAD_INPUT' });
      }
    }

    const cartService = new CartService();
    try {
      const result = await cartService.assembleCart(body.variantIds);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return reply.code(500).send({ error: message, code: 'CART_ERROR' });
    }
  });

  done();
};