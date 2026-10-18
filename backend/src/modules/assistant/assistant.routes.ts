import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { requireAuth } from '../../plugins/auth.js';
import { requireActiveCreator } from '../creators/creator.service.js';
import { reserveAssistantQuota, releaseQuota, AI_QUOTA } from '../../lib/ai-metrics.js';
import { billingActive, planContextForCreator, planLimitError, searchUpgradeHint } from '../billing/billing.gating.js';
import { planLabel } from '../billing/plans.js';
import { RATE_LIMITS } from '../../config/constants.js';
import { Errors } from '../../types/index.js';
import { logger } from '../../lib/logger.js';
import { assistantProductSearchSchema } from './assistant.schema.js';
import { findProductsForMessage } from './assistant.service.js';

async function assistantRoutes(app: FastifyInstance) {
  app.post('/assistant/products', {
    preHandler: [requireAuth],
    config: { rateLimit: RATE_LIMITS.ASSISTANT_SEARCH },
  }, async (request, reply) => {
    const input = assistantProductSearchSchema.parse(request.body);

    try {
      const creator = await requireActiveCreator(request.authUser.id);
      // Cota por plano quando o billing está ativo; cotas globais quando não.
      if (billingActive()) {
        const { plan, limits } = planContextForCreator(creator);
        const limit = limits.searchesPerDay;
        if (limit === 0) {
          throw planLimitError(
            `Sua conta está sem plano ativo — assine para buscar produtos.${searchUpgradeHint(plan)}`,
          );
        }
        const dailyLimit = limit ?? AI_QUOTA.ASSISTANT_PER_DAY;
        if (!await reserveAssistantQuota(request.authUser.id, dailyLimit)) {
          throw planLimitError(
            `Você atingiu o limite de ${dailyLimit} buscas por dia do plano ${planLabel(plan)}.${searchUpgradeHint(plan)}`,
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
        return reply.send(response);
      } catch (error) {
        await releaseQuota(request.authUser.id, 'assistant');
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
}

export default fp(assistantRoutes, { name: 'assistant-routes' });
