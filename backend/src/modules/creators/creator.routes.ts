import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { requireAuth } from '../../plugins/auth.js';
import { RATE_LIMITS } from '../../config/constants.js';
import { onboardingSchema } from './creator.schema.js';
import * as creatorService from './creator.service.js';

async function creatorRoutes(fastify: FastifyInstance) {
  // GET /me
  fastify.get('/me', {
    preHandler: [requireAuth],
    config: { rateLimit: RATE_LIMITS.AUTH_GET },
  }, async (request, reply) => {
    const result = await creatorService.getMe(request.authUser.id, request.authUser.email);
    reply.header('cache-control', 'private, no-store');
    return reply.send(result);
  });

  // POST /creators/onboarding
  fastify.post('/creators/onboarding', {
    preHandler: [requireAuth],
    config: { rateLimit: RATE_LIMITS.AUTH_WRITE },
  }, async (request, reply) => {
    const body = onboardingSchema.parse(request.body);
    const creator = await creatorService.onboarding(request.authUser.id, body, { email: request.authUser.email });
    return reply.status(201).send(creator);
  });
}

export default fp(creatorRoutes, { name: 'creator-routes' });
