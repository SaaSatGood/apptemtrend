import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';
import { RATE_LIMITS } from '../config/constants.js';

async function rateLimitPlugin(fastify: FastifyInstance) {
  await fastify.register(rateLimit, {
    max: RATE_LIMITS.AUTH_GET.max,
    timeWindow: RATE_LIMITS.AUTH_GET.timeWindow,
    keyGenerator: (request) => {
      return request.authUser?.id || request.ip;
    },
    errorResponseBuilder: () => ({
      error: {
        code: 'RATE_LIMITED',
        message: 'Muitas requisições. Tente novamente em breve.',
      },
    }),
  });
}

export default fp(rateLimitPlugin, { name: 'rate-limit' });
