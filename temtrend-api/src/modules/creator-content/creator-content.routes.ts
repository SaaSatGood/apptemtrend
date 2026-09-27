import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { z } from 'zod';
import { requireAuth } from '../../plugins/auth.js';
import { createCreatorContentSchema, updateCreatorContentSchema } from './creator-content.schema.js';
import * as creatorContentService from './creator-content.service.js';

async function creatorContentRoutes(fastify: FastifyInstance) {
  // GET /creator-content — identity comes from JWT only
  fastify.get('/creator-content', {
    preHandler: [requireAuth],
    config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    try {
      const content = await creatorContentService.getCreatorContent(request.authUser.id);
      return reply.send(content);
    } catch (err: any) {
      if (err.statusCode) {
        return reply.status(err.statusCode).send({ error: { code: err.code, message: err.message } });
      }
      throw err;
    }
  });

  // POST /creator-content — save opportunity
  fastify.post('/creator-content', {
    preHandler: [requireAuth],
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    try {
      const body = createCreatorContentSchema.parse(request.body);
      const content = body.product_id
        ? await creatorContentService.saveProduct(request.authUser.id, body.product_id)
        : await creatorContentService.saveOpportunity(request.authUser.id, body.content_kit_id!);
      return reply.status(201).send(content);
    } catch (err: any) {
      if (err.statusCode) {
        return reply.status(err.statusCode).send({ error: { code: err.code, message: err.message } });
      }
      throw err;
    }
  });

  // PATCH /creator-content/:id — update status
  fastify.patch('/creator-content/:id', {
    preHandler: [requireAuth],
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = updateCreatorContentSchema.parse(request.body);
      const content = await creatorContentService.updateCreatorContentStatus(
        request.authUser.id,
        id,
        body,
      );
      return reply.send(content);
    } catch (err: any) {
      if (err.statusCode) {
        return reply.status(err.statusCode).send({ error: { code: err.code, message: err.message } });
      }
      throw err;
    }
  });
}

export default fp(creatorContentRoutes, { name: 'creator-content-routes' });
