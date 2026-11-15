import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { z } from 'zod';
import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { RATE_LIMITS } from '../../config/constants.js';
import { requireAuth } from '../../plugins/auth.js';
import { logger } from '../../lib/logger.js';
import { requireActiveCreator } from '../creators/creator.service.js';
import { billingActive } from './billing.gating.js';
import * as billingService from './billing.service.js';
import { parseWebhookEvent } from './billing.events.js';
import {
  PLAN_LIMITS,
  PLAN_META,
  FREE_KITS_PER_WEEK,
  FREE_SEARCHES_PER_WEEK,
  formatCents,
  type CatalogPlanId,
} from './plans.js';

const checkoutSchema = z.object({
  plan: z.enum(['pro']),
  period: z.enum(['monthly', 'annual']).optional().default('monthly'),
  method: z.enum(['card', 'pix']).optional(),
}).strict();

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

const PUBLIC_PLANS: CatalogPlanId[] = ['pro', 'enterprise'];

async function billingRoutes(app: FastifyInstance) {
  // Catálogo público para a página de planos.
  app.get('/billing/plans', {
    config: { rateLimit: RATE_LIMITS.AUTH_GET },
  }, async (_request, reply) => {
    reply.header('cache-control', 'public, max-age=300');
    const enabled = billingActive();
    const launch = enabled ? await billingService.getLaunchAvailability() : null;
    return {
      enabled,
      trial_days: 0,
      free: {
        searches_per_week: FREE_SEARCHES_PER_WEEK,
        kits_per_week: FREE_KITS_PER_WEEK,
        // Compatibilidade com clientes antigos.
        searches_total: FREE_SEARCHES_PER_WEEK,
        kits_total: FREE_KITS_PER_WEEK,
      },
      launch,
      plans: PUBLIC_PLANS.map((id) => ({
        ...PLAN_META[id],
        precoMensal: formatCents(PLAN_META[id].precoMensalCents),
        precoAnual: formatCents(PLAN_META[id].precoAnualCents),
        precoLancamentoMensal: formatCents(PLAN_META[id].precoLancamentoMensalCents),
        precoLancamentoAnual: formatCents(PLAN_META[id].precoLancamentoAnualCents),
        limits: PLAN_LIMITS[id],
      })),
    };
  });

  // Estado da assinatura + uso atual (kits, buscas).
  app.get('/billing/subscription', {
    preHandler: [requireAuth],
    config: { rateLimit: RATE_LIMITS.AUTH_GET },
  }, async (request, reply) => {
    const creator = await requireActiveCreator(request.authUser.id);
    reply.header('cache-control', 'private, no-store');
    return billingService.getSubscriptionSummary(request.authUser.id, creator);
  });

  // Inicia checkout hospedado da assinatura (v2 AbacatePay).
  app.post('/billing/checkout', {
    preHandler: [requireAuth],
    config: { rateLimit: RATE_LIMITS.BILLING_CHECKOUT },
  }, async (request) => {
    const body = checkoutSchema.parse(request.body ?? {});
    const creator = await requireActiveCreator(request.authUser.id);
    return billingService.startCheckout(request.authUser.id, creator, body.plan, body.period, body.method);
  });

  // Cancela a assinatura (acesso mantido até o fim do período pago).
  app.post('/billing/cancel', {
    preHandler: [requireAuth],
    config: { rateLimit: RATE_LIMITS.AUTH_WRITE },
  }, async (request) => {
    const creator = await requireActiveCreator(request.authUser.id);
    return billingService.cancelSubscription(request.authUser.id, creator);
  });

  // Troca de plano agendada para o próximo ciclo (upgrade/downgrade sem pró-rata).
  app.post('/billing/change-plan', {
    preHandler: [requireAuth],
    config: { rateLimit: RATE_LIMITS.BILLING_CHECKOUT },
  }, async (request) => {
    const body = z.object({
      plan: z.enum(['pro']),
      period: z.enum(['monthly', 'annual']).optional().default('monthly'),
    }).strict().parse(request.body ?? {});
    const creator = await requireActiveCreator(request.authUser.id);
    return billingService.schedulePlanChange(creator, body.plan, body.period);
  });

  // Webhook AbacatePay v2 — autenticado por segredo no header
  // `x-webhook-secret` (preferencial) ou na query (?webhookSecret=...), que
  // mantemos por compatibilidade com o painel do provedor. A URL nunca é logada.
  // Sem segredo configurado, recusa tudo: nunca libera plano sem prova.
  app.post('/billing/webhook', {
    config: { rateLimit: RATE_LIMITS.BILLING_WEBHOOK },
  }, async (request, reply) => {
    const configured = env.ABACATEPAY_WEBHOOK_SECRET;
    if (!configured) {
      logger.warn('AbacatePay webhook received but ABACATEPAY_WEBHOOK_SECRET is not configured');
      return reply.status(503).send({ error: { code: 'WEBHOOK_DISABLED', message: 'Webhook não configurado.' } });
    }
    const query = request.query as Record<string, unknown> | undefined;
    const headerSecret = request.headers['x-webhook-secret'];
    const provided = typeof headerSecret === 'string' && headerSecret
      ? headerSecret
      : typeof query?.webhookSecret === 'string'
        ? query.webhookSecret
        : '';
    if (!provided || !safeEqual(provided, configured)) {
      logger.warn('AbacatePay webhook rejected: invalid secret');
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Assinatura do webhook inválida.' } });
    }
    const event = parseWebhookEvent(request.body);
    if (!event) {
      return reply.status(400).send({ error: { code: 'BAD_REQUEST', message: 'Evento inválido.' } });
    }
    const result = await billingService.processWebhook(event);
    return reply.send({ ok: true, result });
  });

  // Webhook Asaas (cartão). Autenticado pelo token configurado no painel
  // Asaas, enviado no header `asaas-access-token`.
  app.post('/billing/webhook/asaas', {
    config: { rateLimit: RATE_LIMITS.BILLING_WEBHOOK },
  }, async (request, reply) => {
    const configured = env.ASAAS_WEBHOOK_TOKEN;
    if (!configured) {
      logger.warn('Asaas webhook received but ASAAS_WEBHOOK_TOKEN is not configured');
      return reply.status(503).send({ error: { code: 'WEBHOOK_DISABLED', message: 'Webhook não configurado.' } });
    }
    const provided = request.headers['asaas-access-token'];
    if (typeof provided !== 'string' || !safeEqual(provided, configured)) {
      logger.warn('Asaas webhook rejected: invalid token');
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Token do webhook inválido.' } });
    }
    const event = request.body as { id?: string; event?: string } | null;
    if (!event?.id || !event?.event) {
      return reply.status(400).send({ error: { code: 'BAD_REQUEST', message: 'Evento inválido.' } });
    }
    const result = await billingService.processAsaasWebhook(event as Parameters<typeof billingService.processAsaasWebhook>[0]);
    return reply.send({ ok: true, result });
  });
}

export default fp(billingRoutes, { name: 'billing-routes' });
