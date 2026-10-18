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

const idParam = z.object({ id: z.string().uuid() });

const createSchema = z.object({
  subject: z.string().trim().min(3).max(120),
  category: z.enum(SUPPORT_CATEGORIES).default('duvida'),
  message: z.string().trim().min(5).max(2000),
}).strict();

const messageSchema = z.object({
  body: z.string().trim().min(1).max(2000),
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
}

export default fp(supportRoutes, { name: 'support-routes' });
