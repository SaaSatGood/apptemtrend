import { FastifyInstance, FastifyError } from 'fastify';
import fp from 'fastify-plugin';
import { ZodError } from 'zod';
import { logger } from '../lib/logger.js';
import { env } from '../config/env.js';

async function errorHandlerPlugin(fastify: FastifyInstance) {
  fastify.setErrorHandler((error: FastifyError, request, reply) => {
    const requestId = request.id;

    // Zod validation errors
    if (error instanceof ZodError) {
      const messages = error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
      logger.warn({ requestId, validationErrors: error.issues }, 'Validation error');
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: messages,
        },
      });
    }

    // Rate limit errors (statusCode 429)
    if (error.statusCode === 429) {
      return reply.status(429).send({
        error: {
          code: 'RATE_LIMITED',
          message: 'Muitas requisições. Tente novamente em breve.',
        },
      });
    }

    // Known HTTP errors
    if (error.statusCode && error.statusCode < 500) {
      logger.warn({ requestId, err: error }, 'Client error');
      return reply.status(error.statusCode).send({
        error: {
          code: error.code || 'CLIENT_ERROR',
          message: error.message,
        },
      });
    }

    // Unknown/server errors
    logger.error({ requestId, err: error }, 'Internal server error');
    return reply.status(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: env.NODE_ENV === 'production'
          ? 'Erro interno do servidor.'
          : error.message,
      },
    });
  });
}

export default fp(errorHandlerPlugin, { name: 'error-handler' });
