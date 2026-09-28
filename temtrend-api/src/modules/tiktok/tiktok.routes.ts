import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { env } from '../../config/env.js';
import { requireAdmin, requireAuth } from '../../plugins/auth.js';
import { TikTokApiClient } from './tiktok.api-client.js';
import { TikTokAuthorizationError, TikTokVideoValidationError } from './tiktok.errors.js';
import { TikTokOAuthService } from './tiktok.oauth.service.js';
import { TikTokPublishService } from './tiktok.publish.service.js';
import * as repository from './tiktok.repository.js';
import { callbackQuerySchema, creatorContentFieldSchema, postIdSchema, publishSchema } from './tiktok.schemas.js';
import { TikTokService } from './tiktok.service.js';

const client = new TikTokApiClient();
const oauth = new TikTokOAuthService(client);
const service = new TikTokService(client, oauth);
const publisher = new TikTokPublishService(client, oauth);

async function routes(app: FastifyInstance) {
  const read = { preHandler: [requireAuth], config: { rateLimit: { max: 60, timeWindow: '1 minute' } } };
  const write = { preHandler: [requireAuth], config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };

  app.get('/tiktok/connect', read, async (request, reply) => {
    const authorizationUrl = await oauth.createAuthorizationUrl(request.authUser.id);
    if ((request.query as { format?: string }).format === 'json') return { authorizationUrl };
    return reply.redirect(authorizationUrl);
  });

  app.get('/tiktok/callback', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    let errorCode = '';
    try {
      const query = callbackQuerySchema.parse(request.query);
      if (query.error || !query.code) throw new TikTokAuthorizationError(query.error_description || 'A conexão com o TikTok foi cancelada.');
      await oauth.handleCallback(query.code, query.state);
    } catch (error) {
      errorCode = error instanceof TikTokAuthorizationError ? error.code : 'TIKTOK_AUTHORIZATION_ERROR';
    }
    const target = new URL('/app', env.FRONTEND_URL);
    target.searchParams.set('tiktok', errorCode ? 'error' : 'connected');
    if (errorCode) target.searchParams.set('reason', errorCode);
    return reply.redirect(target.toString());
  });

  app.get('/tiktok/account', read, async (request) => oauth.getAccountForUser(request.authUser.id));
  app.delete('/tiktok/account', write, async (request, reply) => { await oauth.disconnect(request.authUser.id); return reply.status(204).send(); });
  app.get('/tiktok/creator-info', { preHandler: [requireAuth], config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request) => service.getCreatorInfo(request.authUser.id));

  app.post('/tiktok/posts', write, async (request, reply) => {
    const file = await request.file();
    if (!file) throw new TikTokVideoValidationError('Selecione um vídeo para continuar.');
    const field = (file.fields.creator_content_id as any)?.value;
    const creatorContentId = creatorContentFieldSchema.parse(field);
    const result = await service.createPost(request.authUser.id, creatorContentId, { stream: file.file, filename: file.filename, mimeType: file.mimetype });
    if (file.file.truncated) throw new TikTokVideoValidationError('O vídeo excede o tamanho máximo permitido.');
    return reply.status(201).send(result);
  });

  app.get('/tiktok/posts/:id', read, async (request) => service.getPost(request.authUser.id, postIdSchema.parse(request.params).id));
  app.post('/tiktok/posts/:id/publish', { preHandler: [requireAuth], config: { rateLimit: { max: 6, timeWindow: '1 minute' } } }, async (request) => publisher.publish(request.authUser.id, postIdSchema.parse(request.params).id, publishSchema.parse(request.body)));
  app.post('/tiktok/posts/:id/retry', { preHandler: [requireAuth], config: { rateLimit: { max: 6, timeWindow: '1 minute' } } }, async (request) => publisher.publish(request.authUser.id, postIdSchema.parse(request.params).id, publishSchema.parse(request.body)));
  app.post('/tiktok/posts/:id/status/refresh', { preHandler: [requireAuth], config: { rateLimit: { max: 6, timeWindow: '1 minute' } } }, async (request) => publisher.refreshStatus(request.authUser.id, postIdSchema.parse(request.params).id));

  app.get('/admin/tiktok/posts', { preHandler: [requireAdmin], config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async () => repository.listAdminPosts());
}

export default fp(routes, { name: 'tiktok-routes' });

