import Fastify from 'fastify';
import multipart from '@fastify/multipart';
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

export function buildApp() {
  const app = Fastify({ logger: false, requestIdHeader: 'x-request-id' });
  app.register(errorHandler);
  app.setNotFoundHandler((_request, reply) => {
    return reply.status(404).send({
      error: { code: 'RESOURCE_NOT_FOUND', message: 'Rota não encontrada.' },
    });
  });
  app.register(cors);
  app.register(rateLimit);
  app.register(auth);
  app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024, files: 1 } });

  app.addHook('onRequest', async (request) => {
    request.log.info({ requestId: request.id, method: request.method, route: request.url }, 'request.started');
  });
  app.addHook('onResponse', async (request, reply) => {
    request.log.info({ requestId: request.id, status: reply.statusCode, durationMs: (reply as any).getResponseTime?.() }, 'request.completed');
  });
  app.get('/health', async () => ({ status: 'ok' }));
  app.register(creatorRoutes);
  app.register(productRoutes);
  app.register(creatorContentRoutes);
  app.register(adminRoutes);
  app.register(storageRoutes);
  app.register(accountRoutes);
  return app;
}
