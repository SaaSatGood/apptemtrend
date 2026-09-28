import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { z } from 'zod';
import { requireAuth } from '../../plugins/auth.js';
import { RATE_LIMITS } from '../../config/constants.js';
import { productQuerySchema } from './product.schema.js';
import * as productService from './product.service.js';

async function productRoutes(fastify: FastifyInstance) {
  // GET /products
  fastify.get('/products', {
    preHandler: [requireAuth],
    config: { rateLimit: RATE_LIMITS.AUTH_GET },
  }, async (request, reply) => {
    const query = productQuerySchema.parse(request.query);
    const filters: { categoria?: string; destaque?: boolean } = {};

    if (query.categoria) filters.categoria = query.categoria;
    if (query.destaque === 'true') filters.destaque = true;
    if (query.destaque === 'false') filters.destaque = false;

    const products = await productService.getProducts(filters);
    return reply.send(products);
  });

  // GET /products/:id
  fastify.get('/products/:id', {
    preHandler: [requireAuth],
    config: { rateLimit: RATE_LIMITS.AUTH_GET },
  }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const result = await productService.getProductById(id);
    return reply.send(result);
  });
}

export default fp(productRoutes, { name: 'product-routes' });
