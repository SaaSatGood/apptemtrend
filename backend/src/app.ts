import Fastify, { LogController } from 'fastify';
import compress from '@fastify/compress';
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
import { supabaseAdmin } from './lib/supabase.js';
import { aiStatus } from './modules/assistant/ai.service.js';

export function buildApp() {
  const app = Fastify({
    loggerInstance: logger,
    logController: new LogController({ disableRequestLogging: true }),
    trustProxy: true,
  });
  app.register(errorHandler);
  app.register(compress, { global: true, threshold: 1024 });
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
  app.addHook('onSend', async (request, reply, payload) => {
    reply.header('x-content-type-options', 'nosniff');
    reply.header('x-frame-options', 'DENY');
    reply.header('referrer-policy', 'no-referrer');
    reply.header('permissions-policy', 'camera=(), microphone=(), geolocation=(), browsing-topics=()');
    reply.header('content-security-policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    reply.header('x-request-id', request.id);
    // HSTS somente quando a conexão já é TLS (evita travar localhost).
    const proto = String(request.headers['x-forwarded-proto'] ?? request.protocol ?? '');
    if (proto.includes('https')) {
      reply.header('strict-transport-security', 'max-age=63072000; includeSubDomains');
    }
    return payload;
  });
  app.get('/health', { config: { rateLimit: false } }, async () => ({ status: 'ok' }));
  app.get('/ready', { config: { rateLimit: false } }, async (_request, reply) => {
    const database = process.env.NODE_ENV === 'test' ? true : await Promise.race([
      supabaseAdmin.from('products').select('id', { head: true, count: 'exact' }).limit(1),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Database readiness timeout')), 3_000)),
    ]).then((result) => !result.error).catch(() => false);
    const ai = aiStatus();
    const status = database ? 'ok' : 'degraded';
    return reply.status(database ? 200 : 503).send({
      status,
      uptime_s: Math.round(process.uptime()),
      ai_configured: ai.configured,
      ai_provider: ai.provider,
      ai_model: ai.model,
      dependencies: {
        database: database ? 'ok' : 'unavailable',
        ai: ai.configured ? 'configured' : 'fallback',
      },
    });
  });
  app.register(creatorRoutes);
  app.register(productRoutes);
  app.register(assistantRoutes);
  app.register(creatorContentRoutes);
  app.register(adminRoutes);
  app.register(storageRoutes);
  app.register(accountRoutes);
  return app;
}
