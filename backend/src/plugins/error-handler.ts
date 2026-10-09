import { FastifyInstance, FastifyError } from 'fastify';
import fp from 'fastify-plugin';
import { ZodError } from 'zod';
import { logger } from '../lib/logger.js';

async function errorHandlerPlugin(fastify: FastifyInstance) {
  fastify.setErrorHandler((error: FastifyError, request, reply) => {
    const requestId = request.id;

    // Zod validation errors — user-facing copy only, details stay in the logs
    if (error instanceof ZodError) {
      const messages = [...new Set(error.issues.map((issue) => (
        issue.code === 'unrecognized_keys'
          ? 'Alguns dados enviados não são válidos.'
          : issue.message
      )))].join(' ');
      logger.warn({ requestId, validationErrors: error.issues }, 'Validation error');
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: messages || 'Confira os dados informados e tente novamente.',
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

    // Application errors thrown as plain objects already carry a user-facing message.
    const raw = error as { statusCode?: number; code?: string; message?: string };
    const isAppError = !(error instanceof Error)
      && typeof raw.statusCode === 'number'
      && typeof raw.code === 'string'
      && typeof raw.message === 'string';
    if (isAppError && raw.statusCode! >= 500) {
      logger.error({ requestId, err: error }, 'Handled application error');
      return reply.status(raw.statusCode!).send({
        error: { code: raw.code!, message: raw.message! },
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

    // Supabase/PostgREST errors expose `status` + a SQL code instead of `statusCode`.
    const pg = error as { status?: number; code?: string };
    if (pg.code === '23505' || pg.code === '23503') {
      logger.warn({ requestId, err: error }, 'Database constraint conflict');
      return reply.status(409).send({
        error: {
          code: 'CONFLICT',
          message: 'Este registro já existe ou está em uso.',
        },
      });
    }

    if (typeof pg.status === 'number' && pg.status >= 400 && pg.status < 500) {
      logger.warn({ requestId, err: error }, 'Database client error');
      return reply.status(pg.status).send({
        error: {
          code: pg.code || 'CLIENT_ERROR',
          message: 'Não foi possível concluir essa ação. Tente novamente.',
        },
      });
    }

    // Unknown/server errors
    logger.error({ requestId, err: error }, 'Internal server error');
    return reply.status(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Não conseguimos concluir agora. Tente novamente.',
      },
    });
  });
}

export default fp(errorHandlerPlugin, { name: 'error-handler' });
