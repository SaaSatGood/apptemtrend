import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { z } from 'zod';
import { requireAuth } from '../../plugins/auth.js';
import { requireActiveCreator } from '../creators/creator.service.js';
import { reserveAssistantQuota, reserveFreeAssistantQuota, releaseFreeQuota, releaseQuota, AI_QUOTA } from '../../lib/ai-metrics.js';
import { billingActive, planContextForCreator, planLimitError, searchUpgradeHint } from '../billing/billing.gating.js';
import { FREE_SEARCHES_TOTAL, planLabel } from '../billing/plans.js';
import { RATE_LIMITS } from '../../config/constants.js';
import { Errors } from '../../types/index.js';
import { logger } from '../../lib/logger.js';
import { assistantProductSearchSchema } from './assistant.schema.js';
import { findProductsForMessage, isGreetingOnly } from './assistant.service.js';
import { clearSearches, deleteSearch, getSearch, listSearches, saveSearch } from './search-history.service.js';

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
        if (!await reserveFreeAssistantQuota(request.authUser.id, FREE_SEARCHES_TOTAL)) {
          throw planLimitError(`Você usou as ${FREE_SEARCHES_TOTAL} pesquisas do plano Grátis.${searchUpgradeHint(plan)}`);
        }
      } else if (billingActive()) {
        const limit = limits.searchesPerDay;
        const dailyLimit = limit ?? AI_QUOTA.ASSISTANT_PER_DAY;
        if (!await reserveAssistantQuota(request.authUser.id, dailyLimit)) {
          throw planLimitError(
            limit === null
              ? 'Você atingiu o limite diário de uso justo. Tente novamente amanhã.'
              : `Você atingiu o limite de ${dailyLimit} buscas por dia do plano ${planLabel(plan)}.${searchUpgradeHint(plan)}`,
          );
        }
      } else if (!await reserveAssistantQuota(request.authUser.id)) {
        throw Errors.CONFLICT('Limite diário de buscas atingido. Tente novamente amanhã.');
      }
      try {
        const response = await findProductsForMessage(input, {
          temas_interesse: creator.temas_interesse,
          estilos_conteudo: creator.estilos_conteudo,
        });
        // Histórico do Descobrir: guarda o retrato da resposta para reabrir
        // depois sem nova chamada de IA (falha aqui não derruba a busca).
        // Saudações não entram: não são uma pesquisa de produto.
        if (countedSearch) {
          await saveSearch({
            creatorId: creator.id,
            userId: request.authUser.id,
            query: input.message,
            message: response.message,
            products: response.products,
            needsClarification: response.needs_clarification,
          });
        }
        return reply.send(response);
      } catch (error) {
        if (plan === 'free' && countedSearch) await releaseFreeQuota(request.authUser.id, 'assistant');
        else await releaseQuota(request.authUser.id, 'assistant');
        throw error;
      }
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status && status < 500) throw error;
      logger.error({ err: error }, 'Assistant product search failed');
      return reply.status(503).send({
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Não conseguimos buscar os produtos agora. Tente novamente.',
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
}

export default fp(assistantRoutes, { name: 'assistant-routes' });
