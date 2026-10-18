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
  TRIAL_DAYS,
  formatCents,
  type CatalogPlanId,
} from './plans.js';

const checkoutSchema = z.object({
  plan: z.enum(['essencial', 'pro', 'scale']),
  period: z.enum(['monthly', 'annual']).optional().default('monthly'),
}).strict();

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

const PUBLIC_PLANS: CatalogPlanId[] = ['essencial', 'pro', 'scale', 'enterprise'];

async function billingRoutes(app: FastifyInstance) {
  // Catálogo público para a página de planos.
  app.get('/billing/plans', {
    config: { rateLimit: RATE_LIMITS.AUTH_GET },
  }, async (_request, reply) => {
    reply.header('cache-control', 'public, max-age=300');
    return {
      enabled: billingActive(),
      trial_days: TRIAL_DAYS,
      plans: PUBLIC_PLANS.map((id) => ({
        ...PLAN_META[id],
        precoMensal: formatCents(PLAN_META[id].precoMensalCents),
        precoAnual: formatCents(PLAN_META[id].precoAnualCents),
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
    return billingService.startCheckout(request.authUser.id, creator, body.plan, body.period);
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
      plan: z.enum(['essencial', 'pro', 'scale']),
      period: z.enum(['monthly', 'annual']).optional().default('monthly'),
    }).strict().parse(request.body ?? {});
    const creator = await requireActiveCreator(request.authUser.id);
    return billingService.schedulePlanChange(creator, body.plan, body.period);
  });

  // Webhook AbacatePay v2 — autenticado por segredo na query (?webhookSecret=...).
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
    const provided = typeof query?.webhookSecret === 'string' ? query.webhookSecret : '';
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
}

export default fp(billingRoutes, { name: 'billing-routes' });
