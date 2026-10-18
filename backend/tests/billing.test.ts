import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      insert: vi.fn(async () => ({ error: null })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })),
      })),
    })),
    auth: { getUser: vi.fn(async () => ({ data: { user: null }, error: { message: 'no token' } })) },
  },
}));

import { buildApp } from '../src/app.js';
import { effectivePlan } from '../src/modules/billing/billing.gating.js';
import {
  extendPeriodEnd,
  extractCheckout,
  extractSubscription,
  parseWebhookEvent,
} from '../src/modules/billing/billing.events.js';
import {
  PLAN_LIMITS,
  planPeriodForProductId,
  productIdFor,
} from '../src/modules/billing/plans.js';
import { createAppError } from '../src/types/index.js';

const future = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
const past = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

describe('billing plan catalog', () => {
  it('maps plan+period to AbacatePay products and back', () => {
    expect(productIdFor('pro', 'monthly')).toBe('prod_p4cS64H2MtnhrrU4YjBCDmKp');
    expect(productIdFor('pro', 'annual')).toBe('prod_f1hLdGkZnkmfu4ab2Pu4Jrt5');
    expect(planPeriodForProductId('prod_p4cS64H2MtnhrrU4YjBCDmKp')).toEqual({ plan: 'pro', period: 'monthly' });
    expect(planPeriodForProductId('prod_unknown')).toBeNull();
    expect(planPeriodForProductId(null)).toBeNull();
  });

  it('keeps the report price matrix (sem plano grátis, sem avulso)', () => {
    expect(PLAN_LIMITS.essencial.kitsPerMonth).toBe(30);
    expect(PLAN_LIMITS.pro.kitsPerMonth).toBe(100);
    expect(PLAN_LIMITS.scale.kitsPerMonth).toBe(300);
    expect(PLAN_LIMITS.enterprise.kitsPerMonth).toBe(1000);
    expect(PLAN_LIMITS.essencial.variationCooldownSeconds).toBe(60);
    expect(PLAN_LIMITS.pro.variationCooldownSeconds).toBe(30);
    expect(PLAN_LIMITS.enterprise.searchesPerDay).toBeNull();
  });

  it('locks usage for the post-trial state (free = sem plano ativo)', () => {
    expect(PLAN_LIMITS.free.searchesPerDay).toBe(0);
    expect(PLAN_LIMITS.free.kitsPerMonth).toBe(0);
    expect(PLAN_LIMITS.free.kitsPerProduct).toBe(0);
    expect(PLAN_LIMITS.free.productionItems).toBe(0);
    expect(PLAN_LIMITS.free.variations).toBe(false);
    expect(PLAN_LIMITS.free.vozPersonalizada).toBe(false);
  });
});

describe('effective plan resolution', () => {
  it('returns free for inactive/missing state', () => {
    expect(effectivePlan({ plan: 'pro', plan_status: 'inactive', trial_ends_at: null, current_period_end: null })).toBe('free');
    expect(effectivePlan({ plan: null, plan_status: null, trial_ends_at: null, current_period_end: null })).toBe('free');
    expect(effectivePlan({ plan: 'paid_ultra', plan_status: 'active', trial_ends_at: null, current_period_end: future(10) })).toBe('free');
  });

  it('grants trial only while trial_ends_at is in the future', () => {
    expect(effectivePlan({ plan: 'pro', plan_status: 'trialing', trial_ends_at: future(5), current_period_end: null })).toBe('pro');
    expect(effectivePlan({ plan: 'pro', plan_status: 'trialing', trial_ends_at: past(1), current_period_end: null })).toBe('free');
  });

  it('keeps paid access until the paid period ends (active, past_due, canceled)', () => {
    expect(effectivePlan({ plan: 'essencial', plan_status: 'active', trial_ends_at: null, current_period_end: future(20) })).toBe('essencial');
    expect(effectivePlan({ plan: 'essencial', plan_status: 'active', trial_ends_at: null, current_period_end: past(1) })).toBe('free');
    expect(effectivePlan({ plan: 'scale', plan_status: 'past_due', trial_ends_at: null, current_period_end: future(5) })).toBe('scale');
    expect(effectivePlan({ plan: 'scale', plan_status: 'canceled', trial_ends_at: null, current_period_end: future(5) })).toBe('scale');
    expect(effectivePlan({ plan: 'scale', plan_status: 'canceled', trial_ends_at: null, current_period_end: past(5) })).toBe('free');
  });
});

describe('webhook parsing (v2 shape)', () => {
  it('parses the documented envelope', () => {
    const event = parseWebhookEvent({
      id: 'log_123',
      event: 'subscription.completed',
      apiVersion: 'v2',
      devMode: false,
      data: { subscription: { id: 'subs_1' } },
    });
    expect(event).toEqual({
      id: 'log_123',
      type: 'subscription.completed',
      data: { subscription: { id: 'subs_1' } },
    });
  });

  it('rejects events without id or type', () => {
    expect(parseWebhookEvent({ event: 'x' })).toBeNull();
    expect(parseWebhookEvent({ id: 'log_1' })).toBeNull();
    expect(parseWebhookEvent(null)).toBeNull();
    expect(parseWebhookEvent('nope')).toBeNull();
  });

  it('extracts the subscription snapshot from data.subscription', () => {
    const snapshot = extractSubscription({
      subscription: {
        id: 'subs_1',
        checkoutId: 'bill_1',
        status: 'ACTIVE',
        trialEndsAt: null,
      },
    });
    expect(snapshot).toEqual({ subscriptionId: 'subs_1', checkoutId: 'bill_1', status: 'ACTIVE', trialEndsAt: null });
  });

  it('extracts the checkout snapshot including subscription row id and product', () => {
    const snapshot = extractCheckout({
      checkout: {
        id: 'bill_9',
        externalId: '3f2c4b8a-9d21-4f0e-8a55-6b7c8d9e0f11',
        items: [{ id: productIdFor('pro', 'monthly'), quantity: 1 }],
        metadata: { creator_id: '8a1f0a7e-1f6d-4d3c-9b3e-2f0f3a4b5c6d' },
      },
    });
    expect(snapshot.checkoutId).toBe('bill_9');
    expect(snapshot.externalId).toBe('3f2c4b8a-9d21-4f0e-8a55-6b7c8d9e0f11');
    expect(snapshot.metadataCreatorId).toBe('8a1f0a7e-1f6d-4d3c-9b3e-2f0f3a4b5c6d');
    expect(snapshot.productId).toBe('prod_p4cS64H2MtnhrrU4YjBCDmKp');
  });

  it('extends periods from the farthest date (now vs stored end)', () => {
    const fromPast = extendPeriodEnd(past(40), 'monthly');
    expect(Date.parse(fromPast)).toBeGreaterThan(Date.now());
    const futureEnd = future(10);
    const extended = extendPeriodEnd(futureEnd, 'monthly');
    expect(Date.parse(extended)).toBeGreaterThan(Date.parse(futureEnd));
    const annual = extendPeriodEnd(futureEnd, 'annual');
    expect(Date.parse(annual) - Date.parse(futureEnd)).toBeGreaterThan(360 * 24 * 60 * 60 * 1000);
  });
});

describe('billing routes', () => {
  it('exposes the public plan catalog (disabled by default)', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/billing/plans' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.enabled).toBe(false);
    expect(body.trial_days).toBe(7);
    expect(body.plans).toHaveLength(4);
    expect(body.plans.find((p: { id: string }) => p.id === 'pro').destaque).toBe(true);
    expect(body.avulso).toBeUndefined();
    expect(body.free).toBeUndefined();
    await app.close();
  });

  it('requires auth for the subscription summary', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/billing/subscription' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('refuses webhooks when no secret is configured (never grants without proof)', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/billing/webhook?webhookSecret=whatever',
      payload: { id: 'log_1', event: 'subscription.completed', data: {} },
    });
    expect(res.statusCode).toBe(503);
    expect(res.json().error.code).toBe('WEBHOOK_DISABLED');
    await app.close();
  });

  it('marks plan limits with a dedicated 402 error code', () => {
    const error = createAppError('PLAN_LIMIT', 'Limite do plano atingido.', 402);
    expect(error).toEqual({ code: 'PLAN_LIMIT', message: 'Limite do plano atingido.', statusCode: 402 });
  });
});
