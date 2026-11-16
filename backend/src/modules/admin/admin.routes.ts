import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { z } from 'zod';
import { requireAdmin } from '../../plugins/auth.js';
import { RATE_LIMITS, CREATOR_STATUS, PRODUCT_STATUS } from '../../config/constants.js';
import { env } from '../../config/env.js';
import { supabaseAdmin } from '../../lib/supabase.js';
import * as adminRepo from './admin.repository.js';
import * as creatorRepo from '../creators/creator.repository.js';
import { invalidateMeCache } from '../creators/creator.service.js';
import * as productService from '../products/product.service.js';
import { createProductWithContentKit } from '../products/product.repository.js';
import * as kitService from '../content-kits/content-kit.service.js';
import * as billingService from '../billing/billing.service.js';
import * as supportService from '../support/support.service.js';
import { SUPPORT_STATUSES } from '../support/support.service.js';
import { AI_QUOTA, getAiMetricsSnapshot } from '../../lib/ai-metrics.js';
import { Errors } from '../../types/index.js';
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

export const productsQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum([PRODUCT_STATUS.ATIVO, PRODUCT_STATUS.PAUSADO]).optional(),
  categoria: z.string().trim().max(200).optional(),
  sort: z.enum(['ranking', 'vendas', 'receita', 'nome']).default('ranking'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const leadsQuerySchema = z.object({
  status: z.enum(adminRepo.LEAD_STATUSES).optional(),
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const leadStatusSchema = z.object({ status: z.enum(adminRepo.LEAD_STATUSES) }).strict();

const aiUsageQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(14),
});

export function csvCell(value: unknown): string {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

export function toCsv(headings: string[], rows: unknown[][]): string {
  return [headings, ...rows].map((row) => row.map(csvCell).join(';')).join('\n');
}

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

  app.get('/admin/ai-usage', admin, async (request) => {
    const q = aiUsageQuerySchema.parse(request.query);
    const [snapshot, series, usage] = await Promise.all([
      getAiMetricsSnapshot(),
      adminRepo.aiUsageSeries(q.days),
      adminRepo.aiUsageDailySeries(q.days),
    ]);
    return {
      today: snapshot,
      series,
      usage,
      config: {
        provider: env.AI_PROVIDER,
        model:
          env.AI_PROVIDER === 'opencode'
            ? env.OPENCODE_MODEL
            : env.AI_PROVIDER === 'openrouter'
              ? env.OPENROUTER_MODEL
              : env.GEMINI_MODEL,
        quota_store: env.AI_QUOTA_STORE,
        quotas: AI_QUOTA,
        billing_enabled: env.BILLING_ENABLED,
      },
    };
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
    const q = productsQuerySchema.parse(request.query);
    return adminRepo.listProductsPage(q);
  });

  app.get('/admin/products/categories', admin, async () => {
    return { items: await adminRepo.listProductCategories() };
  });

  // Exporta o mesmo recorte filtrado da listagem (CSV com BOM para Excel).
  app.get('/admin/products/export', admin, async (request, reply) => {
    const q = productsQuerySchema.parse(request.query);
    const rows = await adminRepo.listProductsForExport(q);
    const csv = toCsv(
      ['ID externo', 'Produto', 'Categoria', 'Loja', 'Preço', 'Comissão (%)', 'Vendas no período', 'Crescimento (%)', 'Receita no período (R$)', 'Ranking', 'Destaque', 'Status'],
      rows.map((product) => [
        product.produto_externo_id,
        product.nome,
        product.categoria,
        product.loja_nome,
        product.preco_texto,
        product.comissao_percentual,
        product.unidades_vendidas_periodo,
        product.crescimento_vendas_percentual,
        product.receita_periodo_brl,
        product.ranking_origem,
        product.destaque ? 'sim' : 'não',
        product.status,
      ]),
    );
    reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename="catalogo-temtrend-${new Date().toISOString().slice(0, 10)}.csv"`);
    return `\ufeff${csv}`;
  });

  app.get('/admin/products/:id', admin, async (request) => {
    const { id } = idParam.parse(request.params);
    return productService.getProductById(id, { includePaused: true });
  });

  // ---- Creators ----
  app.get('/admin/creators/:id', admin, async (request) => {
    const { id } = idParam.parse(request.params);
    const detail = await adminRepo.creatorDetail(id);
    if (!detail) throw Errors.NOT_FOUND('Creator');
    const directory = await adminRepo.listUserDirectory();
    const user = directory.get(String((detail.creator as { user_id: string }).user_id));
    return {
      ...detail,
      email: user?.email ?? null,
      nome: user?.nome ?? null,
    };
  });

  // ---- Leads de marca ----
  app.get('/admin/leads', admin, async (request) => {
    const q = leadsQuerySchema.parse(request.query);
    return adminRepo.listLeadsPage(q);
  });

  app.patch('/admin/leads/:id/status', admin, async (request) => {
    const { id } = idParam.parse(request.params);
    const { status } = leadStatusSchema.parse(request.body);
    const updated = await adminRepo.updateLeadStatus(id, status);
    if (!updated) throw Errors.NOT_FOUND('Lead');
    return updated;
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
    const created = await productService.createProduct(input, request.authUser.id);
    adminRepo.invalidateProductCategoriesCache();
    return reply.status(201).send(created);
  });

  app.post('/admin/products/complete', admin, async (request, reply) => {
    const body = z.object({
      product: createProductSchema,
      content_kit: createContentKitSchema,
    }).strict().parse(request.body);
    const result = await createProductWithContentKit(body.product, body.content_kit, request.authUser.id);
    adminRepo.invalidateProductCategoriesCache();
    return reply.status(201).send(result);
  });

  app.patch('/admin/products/:id', admin, async (request) => {
    const { id } = idParam.parse(request.params);
    const updated = await productService.updateProductById(id, updateProductSchema.parse(request.body));
    adminRepo.invalidateProductCategoriesCache();
    return updated;
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
