import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';
import { RATE_LIMITS } from '../config/constants.js';

async function rateLimitPlugin(fastify: FastifyInstance) {
  await fastify.register(rateLimit, {
    // `preValidation` runs right after the auth hook populated `authUser`,
    // so the key is the user id when available and the IP otherwise.
    hook: 'preValidation',
    max: RATE_LIMITS.AUTH_GET.max,
    timeWindow: RATE_LIMITS.AUTH_GET.timeWindow,
    keyGenerator: (request) => request.authUser?.id || request.ip,
    // Must be an Error carrying `statusCode`: a plain object thrown here is
    // routed to the global error handler and would come back as a 500.
    errorResponseBuilder: (_request, context) => {
      const error = new Error('Muitas requisições. Tente novamente em breve.') as Error & {
        statusCode: number;
        code: string;
      };
      error.statusCode = context.statusCode;
      error.code = 'RATE_LIMITED';
      return error;
    },
  });
}

export default fp(rateLimitPlugin, { name: 'rate-limit' });
