import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { z } from 'zod';
import { RATE_LIMITS } from '../../config/constants.js';
import { requireAuth } from '../../plugins/auth.js';
import { requireActiveCreator } from '../creators/creator.service.js';
import {
  SUPPORT_CATEGORIES,
  addCreatorMessage,
  closeCreatorTicket,
  createTicket,
  getCreatorTicket,
  listCreatorTickets,
} from './support.service.js';
import {
  geminiSupportAnswer,
  openrouterSupportAnswer,
  supportContext,
  supportFallbackAnswer,
  type SupportChatMessage,
} from './support-chat.service.js';
import { getCreatorContent } from '../creator-content/creator-content.service.js';

const idParam = z.object({ id: z.string().uuid() });

const createSchema = z.object({
  subject: z.string().trim().min(3).max(120),
  category: z.enum(SUPPORT_CATEGORIES).default('duvida'),
  message: z.string().trim().min(5).max(2000),
}).strict();

const messageSchema = z.object({
  body: z.string().trim().min(1).max(2000),
}).strict();

const chatSchema = z.object({
  message: z.string().trim().min(2).max(2000),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().trim().min(1).max(2000),
  })).max(10).optional(),
}).strict();

async function supportRoutes(app: FastifyInstance) {
  const read = { preHandler: [requireAuth], config: { rateLimit: RATE_LIMITS.AUTH_GET } };
  const write = { preHandler: [requireAuth], config: { rateLimit: RATE_LIMITS.SUPPORT } };

  app.get('/support/tickets', read, async (request) => {
    const creator = await requireActiveCreator(request.authUser.id);
    return { items: await listCreatorTickets(creator.id) };
  });

  app.post('/support/tickets', write, async (request, reply) => {
    const creator = await requireActiveCreator(request.authUser.id);
    const input = createSchema.parse(request.body);
    return reply.status(201).send(await createTicket(creator, input));
  });

  app.get('/support/tickets/:id', read, async (request) => {
    const { id } = idParam.parse(request.params);
    const creator = await requireActiveCreator(request.authUser.id);
    return getCreatorTicket(creator.id, id);
  });

  app.post('/support/tickets/:id/messages', write, async (request) => {
    const { id } = idParam.parse(request.params);
    const creator = await requireActiveCreator(request.authUser.id);
    const { body } = messageSchema.parse(request.body);
    return addCreatorMessage(creator, id, body);
  });

  app.post('/support/tickets/:id/close', write, async (request) => {
    const { id } = idParam.parse(request.params);
    const creator = await requireActiveCreator(request.authUser.id);
    return closeCreatorTicket(creator.id, id);
  });

  // POST /support/chat — assistente de suporte com a mesma IA da plataforma.
  app.post('/support/chat', write, async (request) => {
    const creator = await requireActiveCreator(request.authUser.id);
    const { message, history } = chatSchema.parse(request.body);
    const productions = await getCreatorContent(request.authUser.id);
    const context = supportContext({
      plan: creator.plan,
      planStatus: creator.plan_status,
      productions: productions.length,
      onboardingDone: Boolean(creator.onboarding_completo),
    });
    const turns = history as SupportChatMessage[] | undefined;
    const reply = await geminiSupportAnswer(message, turns, context)
      ?? await openrouterSupportAnswer(message, turns, context)
      ?? supportFallbackAnswer();
    return { reply };
  });
}

export default fp(supportRoutes, { name: 'support-routes' });
