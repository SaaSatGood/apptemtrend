import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { requireAuth } from '../../plugins/auth.js';
import { onboardingSchema } from './creator.schema.js';
import * as creatorService from './creator.service.js';

async function creatorRoutes(fastify: FastifyInstance) {
  // GET /me
  fastify.get('/me', {
    preHandler: [requireAuth],
    config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    try {
      const result = await creatorService.getMe(request.authUser.id);
      return reply.send(result);
    } catch (err: any) {
      if (err.statusCode) {
        return reply.status(err.statusCode).send({ error: { code: err.code, message: err.message } });
      }
      throw err;
    }
  });

  // POST /creators/onboarding
  fastify.post('/creators/onboarding', {
    preHandler: [requireAuth],
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    try {
      const body = onboardingSchema.parse(request.body);
      const creator = await creatorService.onboarding(request.authUser.id, body);
      return reply.status(201).send(creator);
    } catch (err: any) {
      if (err.statusCode) {
        return reply.status(err.statusCode).send({ error: { code: err.code, message: err.message } });
      }
      throw err;
    }
  });
}

export default fp(creatorRoutes, { name: 'creator-routes' });
