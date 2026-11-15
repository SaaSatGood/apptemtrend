import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { z } from 'zod';
import { requireAuth } from '../../plugins/auth.js';
import { requireActiveCreator } from '../creators/creator.service.js';
import { reserveAssistantQuota, reserveFreeAssistantQuota, releaseFreeQuota, releaseQuota } from '../../lib/ai-metrics.js';
import { billingActive, planContextForCreator, planLimitError, searchUpgradeHint } from '../billing/billing.gating.js';
import { FAIR_USE_SEARCHES_PER_DAY, FREE_SEARCHES_PER_WEEK, planLabel } from '../billing/plans.js';
import { RATE_LIMITS } from '../../config/constants.js';
import { Errors, createAppError } from '../../types/index.js';
import { logger } from '../../lib/logger.js';
import { assistantProductSearchSchema, discoverySessionCreateSchema, discoverySessionUpdateSchema } from './assistant.schema.js';
import { findProductsForMessage, isGreetingOnly } from './assistant.service.js';
import { AIService } from './ai.service.js';
import { clearSearches, deleteSearch, getSearch, listSearches, saveSearch } from './search-history.service.js';
import { clearSessions, createSession, deleteSession, getSession, listSessions, updateSession } from './discovery-sessions.service.js';

async function assistantRoutes(app: FastifyInstance) {
  app.post('/assistant/products', {
    preHandler: [requireAuth],
    config: { rateLimit: RATE_LIMITS.ASSISTANT_SEARCH },
  }, async (request, reply) => {
    const input = assistantProductSearchSchema.parse(request.body);
    const countedSearch = !isGreetingOnly(input.message);

    try {
      const creator = await requireActiveCreator(request.authUser.id);
      const { plan, limits } = planContextForCreator(creator);
      if (plan === 'free' && countedSearch) {
        if (!await reserveFreeAssistantQuota(request.authUser.id, FREE_SEARCHES_PER_WEEK)) {
          throw planLimitError(`Você atingiu o limite de pesquisas do plano Grátis.${searchUpgradeHint(plan)}`);
        }
      } else if (billingActive()) {
        const limit = limits.searchesPerDay;
        const dailyLimit = limit ?? FAIR_USE_SEARCHES_PER_DAY;
        if (!await reserveAssistantQuota(request.authUser.id, dailyLimit)) {
          throw planLimitError(
            limit === null
              ? 'Você atingiu o limite de uso justo de buscas de hoje. Ele renova amanhã — se precisar de mais volume, fale com a gente.'
              : `Você já usou as ${dailyLimit} buscas de hoje do plano ${planLabel(plan)}.${searchUpgradeHint(plan)}`,
          );
        }
      } else if (!await reserveAssistantQuota(request.authUser.id, FAIR_USE_SEARCHES_PER_DAY)) {
        throw Errors.CONFLICT('Você atingiu o limite de uso justo de buscas de hoje. Ele renova amanhã.');
      }
      try {
        const visualContext = input.image ? await AIService.describeVisualReference(input.image) : null;
        if (input.image && !visualContext) {
          throw createAppError('IMAGE_ANALYSIS_UNAVAILABLE', 'Não consegui olhar essa imagem agora. Tenta de novo ou me descreve o produto em texto.', 503);
        }
        const effectiveMessage = visualContext
          ? `${input.message}\nReferência visual: ${visualContext.description}. Termos relacionados: ${visualContext.search_terms.join(', ')}.`
          : input.message;
        const response = await findProductsForMessage({ ...input, image: undefined, message: effectiveMessage }, {
          temas_interesse: creator.temas_interesse,
          estilos_conteudo: creator.estilos_conteudo,
        }, request.authUser.id);
        const responseWithContext = visualContext ? { ...response, image_context: visualContext.description } : response;
        // Histórico do Descobrir: guarda o retrato da resposta para reabrir
        // depois sem nova chamada de IA (falha aqui não derruba a busca).
        // Saudações não entram: não são uma pesquisa de produto.
        if (countedSearch) {
          await saveSearch({
            creatorId: creator.id,
            userId: request.authUser.id,
            query: input.message,
            message: responseWithContext.message,
            products: responseWithContext.products,
            needsClarification: responseWithContext.needs_clarification,
          });
        }
        return reply.send(responseWithContext);
      } catch (error) {
        if (plan === 'free' && countedSearch) await releaseFreeQuota(request.authUser.id, 'assistant');
        else await releaseQuota(request.authUser.id, 'assistant');
        throw error;
      }
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status && (status < 500 || (error as { code?: string }).code === 'IMAGE_ANALYSIS_UNAVAILABLE')) throw error;
      logger.error({ err: error }, 'Assistant product search failed');
      return reply.status(503).send({
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Não deu para buscar os produtos agora. Tenta de novo em instantes.',
        },
      });
    }
  });

  // GET /assistant/searches — histórico de buscas do creator (mais recentes primeiro).
  app.get('/assistant/searches', {
    preHandler: [requireAuth],
    config: { rateLimit: RATE_LIMITS.AUTH_GET },
  }, async (request, reply) => {
    const creator = await requireActiveCreator(request.authUser.id);
    reply.header('cache-control', 'private, no-store');
    return reply.send({ items: await listSearches(creator.id) });
  });

  // GET /assistant/searches/:id — busca completa (texto, mensagem e produtos).
  app.get('/assistant/searches/:id', {
    preHandler: [requireAuth],
    config: { rateLimit: RATE_LIMITS.AUTH_GET },
  }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const creator = await requireActiveCreator(request.authUser.id);
    reply.header('cache-control', 'private, no-store');
    return reply.send(await getSearch(creator.id, id));
  });

  // DELETE /assistant/searches/:id — remove uma busca do histórico.
  app.delete('/assistant/searches/:id', {
    preHandler: [requireAuth],
    config: { rateLimit: RATE_LIMITS.AUTH_WRITE },
  }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const creator = await requireActiveCreator(request.authUser.id);
    return reply.send(await deleteSearch(creator.id, id));
  });

  // DELETE /assistant/searches — limpa o histórico do creator.
  app.delete('/assistant/searches', {
    preHandler: [requireAuth],
    config: { rateLimit: RATE_LIMITS.AUTH_WRITE },
  }, async (request, reply) => {
    const creator = await requireActiveCreator(request.authUser.id);
    return reply.send(await clearSearches(creator.id));
  });

  // ─── Sessões do Descobrir: cada conversa vira um link fixo ───
  // POST /assistant/sessions — cria a sessão na primeira busca da conversa.
  app.post('/assistant/sessions', {
    preHandler: [requireAuth],
    config: { rateLimit: RATE_LIMITS.AUTH_WRITE },
  }, async (request, reply) => {
    const input = discoverySessionCreateSchema.parse(request.body);
    const creator = await requireActiveCreator(request.authUser.id);
    const session = await createSession({
      creatorId: creator.id,
      userId: request.authUser.id,
      title: input.title,
      context: input.context,
      turns: input.turns,
    });
    if (!session) {
      return reply.status(503).send({
        error: { code: 'SESSION_UNAVAILABLE', message: 'Não conseguimos salvar esta conversa agora.' },
      });
    }
    return reply.send({ session });
  });

  // GET /assistant/sessions — lista de conversas do creator (histórico da sidebar).
  app.get('/assistant/sessions', {
    preHandler: [requireAuth],
    config: { rateLimit: RATE_LIMITS.AUTH_GET },
  }, async (request, reply) => {
    const creator = await requireActiveCreator(request.authUser.id);
    reply.header('cache-control', 'private, no-store');
    return reply.send({ items: await listSessions(creator.id) });
  });

  // GET /assistant/sessions/:id — conversa completa (turnos restaurados sem IA).
  app.get('/assistant/sessions/:id', {
    preHandler: [requireAuth],
    config: { rateLimit: RATE_LIMITS.AUTH_GET },
  }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const creator = await requireActiveCreator(request.authUser.id);
    reply.header('cache-control', 'private, no-store');
    return reply.send({ session: await getSession(creator.id, id) });
  });

  // PATCH /assistant/sessions/:id — salva a conversa após cada turno novo.
  app.patch('/assistant/sessions/:id', {
    preHandler: [requireAuth],
    config: { rateLimit: RATE_LIMITS.AUTH_WRITE },
  }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const input = discoverySessionUpdateSchema.parse(request.body);
    const creator = await requireActiveCreator(request.authUser.id);
    const session = await updateSession(creator.id, id, input);
    if (!session) {
      return reply.status(503).send({
        error: { code: 'SESSION_UNAVAILABLE', message: 'Não conseguimos salvar esta conversa agora.' },
      });
    }
    return reply.send({ session });
  });

  // DELETE /assistant/sessions/:id — apaga uma conversa do histórico.
  app.delete('/assistant/sessions/:id', {
    preHandler: [requireAuth],
    config: { rateLimit: RATE_LIMITS.AUTH_WRITE },
  }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const creator = await requireActiveCreator(request.authUser.id);
    return reply.send(await deleteSession(creator.id, id));
  });

  // DELETE /assistant/sessions — limpa o histórico de conversas do creator.
  app.delete('/assistant/sessions', {
    preHandler: [requireAuth],
    config: { rateLimit: RATE_LIMITS.AUTH_WRITE },
  }, async (request, reply) => {
    const creator = await requireActiveCreator(request.authUser.id);
    return reply.send(await clearSessions(creator.id));
  });
}

export default fp(assistantRoutes, { name: 'assistant-routes' });
