import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';
import Redis from 'ioredis';
import { RATE_LIMITS } from '../config/constants.js';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

async function rateLimitPlugin(fastify: FastifyInstance) {
  const redis = env.REDIS_URL
    ? new Redis(env.REDIS_URL, {
        connectTimeout: 5_000,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        lazyConnect: true,
      })
    : undefined;

  if (redis) {
    redis.on('error', (error) => logger.error({ err: error }, 'Redis rate-limit store error'));
    await redis.connect().catch((error) => {
      logger.error({ err: error }, 'Redis unavailable; rate limiting will fail open');
    });
    fastify.addHook('onClose', async () => {
      redis.disconnect();
    });
  }

  await fastify.register(rateLimit, {
    // `preValidation` runs right after the auth hook populated `authUser`,
    // so the key is the user id when available and the IP otherwise.
    // O limite global é folgado; rotas caras definem `config.rateLimit` próprio.
    hook: 'preValidation',
    max: RATE_LIMITS.GLOBAL.max,
    timeWindow: RATE_LIMITS.GLOBAL.timeWindow,
    redis,
    skipOnError: true,
    nameSpace: 'temtrend-rate-limit-',
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
