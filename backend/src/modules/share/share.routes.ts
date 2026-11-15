import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { z } from 'zod';
import { requireAuth } from '../../plugins/auth.js';
import { RATE_LIMITS } from '../../config/constants.js';
import { requireActiveCreator } from '../creators/creator.service.js';
import {
  createSharedConversationSchema,
  sharedImportSchema,
  sharedSlugSchema,
} from './share.schema.js';
import {
  createSharedConversation,
  getSharedConversation,
  importSharedKit,
  listSharedConversations,
  revokeSharedConversation,
  shareUrlPath,
} from './share.service.js';

async function shareRoutes(app: FastifyInstance) {
  // POST /share/conversations -- transforma a conversa do Descobrir em um link.
  app.post('/share/conversations', {
    preHandler: [requireAuth],
    config: { rateLimit: RATE_LIMITS.AUTH_WRITE },
  }, async (request, reply) => {
    const input = createSharedConversationSchema.parse(request.body);
    const creator = await requireActiveCreator(request.authUser.id);
    const conversation = await createSharedConversation({
      creatorId: creator.id,
      userId: request.authUser.id,
      title: input.title,
      turns: input.turns,
    });
    reply.header('cache-control', 'private, no-store');
    return reply.status(201).send({ conversation, url_path: shareUrlPath(conversation.slug) });
  });

  // GET /share/conversations -- links ativos criados pelo creator.
  app.get('/share/conversations', {
    preHandler: [requireAuth],
    config: { rateLimit: RATE_LIMITS.AUTH_GET },
  }, async (request, reply) => {
    const creator = await requireActiveCreator(request.authUser.id);
    reply.header('cache-control', 'private, no-store');
    return reply.send({ items: await listSharedConversations(creator.id) });
  });

  // GET /share/conversations/:slug -- a conversa compartilhada (qualquer
  // creator logado pode abrir; o payload nunca expoe dados de outro creator
  // alem dos produtos e roteiros que foram compartilhados).
  app.get('/share/conversations/:slug', {
    preHandler: [requireAuth],
    config: { rateLimit: RATE_LIMITS.AUTH_GET },
  }, async (request, reply) => {
    const { slug } = z.object({ slug: sharedSlugSchema }).parse(request.params);
    const creator = await requireActiveCreator(request.authUser.id);
    reply.header('cache-control', 'private, no-store');
    return reply.send(await getSharedConversation(slug, creator.id));
  });

  // POST /share/conversations/:slug/import -- leva o roteiro do link para a
  // tela de gravar conteudo de quem abriu (copia local, sem chamada de IA).
  app.post('/share/conversations/:slug/import', {
    preHandler: [requireAuth],
    config: { rateLimit: RATE_LIMITS.AUTH_WRITE },
  }, async (request, reply) => {
    const { slug } = z.object({ slug: sharedSlugSchema }).parse(request.params);
    const input = sharedImportSchema.parse(request.body);
    const creator = await requireActiveCreator(request.authUser.id);
    const result = await importSharedKit({
      slug,
      viewer: creator,
      productId: input.product_id,
      contentKitId: input.content_kit_id,
    });
    reply.header('cache-control', 'private, no-store');
    return reply.status(result.created ? 201 : 200).send(result);
  });

  // DELETE /share/conversations/:slug -- desativa o link (so o dono).
  app.delete('/share/conversations/:slug', {
    preHandler: [requireAuth],
    config: { rateLimit: RATE_LIMITS.AUTH_WRITE },
  }, async (request, reply) => {
    const { slug } = z.object({ slug: sharedSlugSchema }).parse(request.params);
    const creator = await requireActiveCreator(request.authUser.id);
    return reply.send(await revokeSharedConversation(creator.id, slug));
  });
}

export default fp(shareRoutes, { name: 'share-routes' });
