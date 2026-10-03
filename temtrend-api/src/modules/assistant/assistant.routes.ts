import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { requireAuth } from '../../plugins/auth.js';
import { requireActiveCreator } from '../creators/creator.service.js';
import { checkAssistantQuota, incrementAssistantQuota } from '../../lib/ai-metrics.js';
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
      await requireActiveCreator(request.authUser.id);
      if (!checkAssistantQuota(request.authUser.id)) {
        throw Errors.CONFLICT('Limite diário de buscas atingido. Tente novamente amanhã.');
      }
      const response = await findProductsForMessage(input);
      incrementAssistantQuota(request.authUser.id);
      return reply.send(response);
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
