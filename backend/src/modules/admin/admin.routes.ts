import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { z } from 'zod';
import { requireAdmin } from '../../plugins/auth.js';
import { RATE_LIMITS, CREATOR_STATUS } from '../../config/constants.js';
import { supabaseAdmin } from '../../lib/supabase.js';
import * as adminRepo from './admin.repository.js';
import * as creatorRepo from '../creators/creator.repository.js';
import { invalidateMeCache } from '../creators/creator.service.js';
import * as productService from '../products/product.service.js';
import { listAllProducts, createProductWithContentKit } from '../products/product.repository.js';
import * as kitService from '../content-kits/content-kit.service.js';
import * as billingService from '../billing/billing.service.js';
import * as supportService from '../support/support.service.js';
import { SUPPORT_STATUSES } from '../support/support.service.js';
import { createProductSchema, updateProductSchema } from '../products/product.schema.js';
import { createContentKitSchema, updateContentKitSchema } from '../content-kits/content-kit.schema.js';

const idParam = z.object({ id: z.string().uuid() });

const creatorsQuerySchema = z.object({
  status: z.enum(['ativo', 'bloqueado']).optional(),
  nicho: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const supportQuerySchema = z.object({
  status: z.enum(SUPPORT_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const supportMessageSchema = z.object({
  body: z.string().trim().min(1).max(2000),
}).strict();

const supportStatusSchema = z.object({
  status: z.enum(SUPPORT_STATUSES),
}).strict();

const funnelQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

function range(page: number, limit?: number) {
  const safeLimit = limit ?? 50;
  return { limit: safeLimit, offset: (page - 1) * safeLimit };
}

async function routes(app: FastifyInstance) {
  const admin = { preHandler: [requireAdmin], config: { rateLimit: RATE_LIMITS.ADMIN } };

  app.get('/admin/dashboard', admin, async (_request, reply) => {
    const data = await adminRepo.dashboard();
    reply.header('cache-control', 'private, no-store');
    return data;
  });

  app.get('/admin/ai-usage', admin, async () => {
    const { getAiMetricsSnapshot } = await import('../../lib/ai-metrics.js');
    return getAiMetricsSnapshot();
  });

  app.get('/admin/creators', admin, async (request) => {
    const q = creatorsQuerySchema.parse(request.query);
    const creators = await creatorRepo.listCreators({
      status: q.status,
      nicho: q.nicho,
      ...range(q.page, q.limit),
    });
    const directory = await adminRepo.listUserDirectory();

    return creators.map((creator) => {
      const user = directory.get(creator.user_id);
      return {
        ...creator,
        email: user?.email ?? null,
        nome: user?.nome ?? null,
      };
    });
  });

  app.get('/admin/products', admin, async (request) => {
    const q = listQuerySchema.parse(request.query);
    return listAllProducts(range(q.page, q.limit));
  });

  app.get('/admin/products/:id', admin, async (request) => {
    const { id } = idParam.parse(request.params);
    return productService.getProductById(id, { includePaused: true });
  });

  app.patch('/admin/creators/:id/status', admin, async (request) => {
    const { id } = idParam.parse(request.params);
    const { status } = z.object({ status: z.enum([CREATOR_STATUS.ATIVO, CREATOR_STATUS.BLOQUEADO]) }).parse(request.body);
    const updated = await creatorRepo.updateCreator(id, { status });
    // /me é cacheado 30s: bloqueio/desbloqueio precisa refletir na hora.
    if (updated?.user_id) invalidateMeCache(updated.user_id);
    adminRepo.invalidateDashboardCache();
    return updated;
  });

  app.post('/admin/products', admin, async (request, reply) => {
    const input = createProductSchema.parse(request.body);
    return reply.status(201).send(await productService.createProduct(input, request.authUser.id));
  });

  app.post('/admin/products/complete', admin, async (request, reply) => {
    const body = z.object({
      product: createProductSchema,
      content_kit: createContentKitSchema,
    }).strict().parse(request.body);
    const result = await createProductWithContentKit(body.product, body.content_kit, request.authUser.id);
    return reply.status(201).send(result);
  });

  app.patch('/admin/products/:id', admin, async (request) => {
    const { id } = idParam.parse(request.params);
    return productService.updateProductById(id, updateProductSchema.parse(request.body));
  });

  app.post('/admin/products/:id/content-kit', admin, async (request, reply) => {
    const { id } = idParam.parse(request.params);
    return reply.status(201).send(await kitService.createContentKit(id, createContentKitSchema.parse(request.body)));
  });

  app.patch('/admin/content-kits/:id', admin, async (request) => {
    const { id } = idParam.parse(request.params);
    return kitService.updateContentKitById(id, updateContentKitSchema.parse(request.body));
  });

  // ---- Assinaturas (billing) ----
  app.get('/admin/billing/summary', admin, async () => billingService.adminBillingSummary());

  app.get('/admin/billing/subscriptions', admin, async (request) => {
    const q = listQuerySchema.parse(request.query);
    return billingService.adminListSubscriptions(q);
  });

  // ---- Funil de eventos (analytics_events via RPC) ----
  app.get('/admin/analytics/funnel', admin, async (request) => {
    const q = funnelQuerySchema.parse(request.query);
    const { data, error } = await supabaseAdmin.rpc('analytics_funnel', { p_days: q.days });
    if (error) {
      request.log.error({ err: error }, 'Failed to load analytics funnel');
      throw error;
    }
    return { days: q.days, events: (data ?? []) as Array<{ event_name: string; total: number }> };
  });

  // ---- Canal de suporte ----
  app.get('/admin/support/tickets', admin, async (request) => {
    const q = supportQuerySchema.parse(request.query);
    return supportService.listAdminTickets(q);
  });

  app.get('/admin/support/tickets/:id', admin, async (request) => {
    const { id } = idParam.parse(request.params);
    return supportService.getAdminTicket(id);
  });

  app.post('/admin/support/tickets/:id/messages', admin, async (request) => {
    const { id } = idParam.parse(request.params);
    const { body } = supportMessageSchema.parse(request.body);
    return supportService.replyAsSupport(id, body, request.authUser.id);
  });

  app.patch('/admin/support/tickets/:id', admin, async (request) => {
    const { id } = idParam.parse(request.params);
    const { status } = supportStatusSchema.parse(request.body);
    return supportService.setAdminTicketStatus(id, status);
  });
}
export default fp(routes, { name: 'admin-routes' });
