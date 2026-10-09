import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { z } from 'zod';
import { requireAuth } from '../../plugins/auth.js';
import { RATE_LIMITS } from '../../config/constants.js';
import { createCreatorContentSchema, selectContentKitSchema, updateCreatorContentSchema } from './creator-content.schema.js';
import * as creatorContentService from './creator-content.service.js';

async function creatorContentRoutes(fastify: FastifyInstance) {
  // GET /creator-content — identity comes from JWT only
  fastify.get('/creator-content', {
    preHandler: [requireAuth],
    config: { rateLimit: RATE_LIMITS.AUTH_GET },
  }, async (request, reply) => {
    const query = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(20),
    }).parse(request.query);
    const content = await creatorContentService.getCreatorContent(request.authUser.id, {
      limit: query.limit,
      offset: (query.page - 1) * query.limit,
    });
    reply.header('cache-control', 'private, no-store');
    return reply.send(content);
  });

  fastify.get('/creator-content/:id', {
    preHandler: [requireAuth],
    config: { rateLimit: RATE_LIMITS.AUTH_GET },
  }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const content = await creatorContentService.getCreatorContentById(request.authUser.id, id);
    reply.header('cache-control', 'private, no-store');
    return reply.send(content);
  });

  // POST /creator-content — save opportunity
  fastify.post('/creator-content', {
    preHandler: [requireAuth],
    config: { rateLimit: RATE_LIMITS.AUTH_WRITE },
  }, async (request, reply) => {
    const body = createCreatorContentSchema.parse(request.body);
    const content = body.product_id
      ? await creatorContentService.startProduction(request.authUser.id, body.product_id, body.content_kit_briefing)
      : await creatorContentService.saveOpportunity(request.authUser.id, body.content_kit_id!);
    return reply.status(201).send(content);
  });

  fastify.post('/creator-content/:id/content-kit', {
    preHandler: [requireAuth],
    config: { rateLimit: RATE_LIMITS.AUTH_WRITE },
  }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = selectContentKitSchema.parse(request.body);
    return reply.send(await creatorContentService.selectContentKit(request.authUser.id, id, body.content_kit_id));
  });

  // PATCH /creator-content/:id — update status
  fastify.patch('/creator-content/:id', {
    preHandler: [requireAuth],
    config: { rateLimit: RATE_LIMITS.AUTH_WRITE },
  }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = updateCreatorContentSchema.parse(request.body);
    const content = await creatorContentService.updateCreatorContentStatus(
      request.authUser.id,
      id,
      body,
    );
    return reply.send(content);
  });
}

export default fp(creatorContentRoutes, { name: 'creator-content-routes' });
