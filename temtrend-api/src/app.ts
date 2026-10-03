import Fastify, { LogController } from 'fastify';
import multipart from '@fastify/multipart';
import { logger } from './lib/logger.js';
import cors from './plugins/cors.js';
import auth from './plugins/auth.js';
import rateLimit from './plugins/rate-limit.js';
import errorHandler from './plugins/error-handler.js';
import creatorRoutes from './modules/creators/creator.routes.js';
import productRoutes from './modules/products/product.routes.js';
import creatorContentRoutes from './modules/creator-content/creator-content.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import storageRoutes from './modules/storage/storage.routes.js';
import accountRoutes from './modules/account/account.routes.js';
import assistantRoutes from './modules/assistant/assistant.routes.js';
import { UPLOAD } from './config/constants.js';

export function buildApp() {
  const app = Fastify({
    loggerInstance: logger,
    logController: new LogController({ disableRequestLogging: true }),
    trustProxy: true,
  });
  app.register(errorHandler);
  app.setNotFoundHandler((_request, reply) => {
    return reply.status(404).send({
      error: { code: 'RESOURCE_NOT_FOUND', message: 'Rota não encontrada.' },
    });
  });
  app.register(cors);
  app.register(rateLimit);
  app.register(auth);
  app.register(multipart, { limits: { fileSize: UPLOAD.MAX_FILE_SIZE, files: 1, fields: 10 } });

  app.addHook('onRequest', async (request) => {
    request.log.info({ requestId: request.id, method: request.method, route: request.url }, 'request.started');
  });
  app.addHook('onResponse', async (request, reply) => {
    request.log.info(
      { requestId: request.id, status: reply.statusCode, durationMs: reply.elapsedTime },
      'request.completed',
    );
  });
  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('x-content-type-options', 'nosniff');
    reply.header('x-frame-options', 'DENY');
    reply.header('referrer-policy', 'no-referrer');
    return payload;
  });
  app.get('/health', { config: { rateLimit: false } }, async () => ({ status: 'ok' }));
  // Readiness sem bater no banco/IA: garante que o processo subiu e configurou.
  app.get('/ready', { config: { rateLimit: false } }, async () => ({
    status: 'ok',
    uptime_s: Math.round(process.uptime()),
  }));
  app.register(creatorRoutes);
  app.register(productRoutes);
  app.register(assistantRoutes);
  app.register(creatorContentRoutes);
  app.register(adminRoutes);
  app.register(storageRoutes);
  app.register(accountRoutes);
  return app;
}
