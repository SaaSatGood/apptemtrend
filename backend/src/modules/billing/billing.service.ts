import { env } from '../../config/env.js';
import { supabaseAdmin } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';
import { createAppError, Errors, type Creator } from '../../types/index.js';
import { invalidateMeCache } from '../creators/creator.service.js';
import { listUserDirectory } from '../admin/admin.repository.js';
import { billingActive, planContextForCreator } from './billing.gating.js';
import {
  PLAN_META,
  planLabel,
  productIdFor,
  type PaidPlanId,
  type PlanLimits,
  type PlanPeriod,
} from './plans.js';
import {
  createSubscriptionCheckout,
  cancelSubscriptionAtProvider,
  changeSubscriptionPlanAtProvider,
} from './billing.provider.js';
import {
  extendPeriodEnd,
  extractCheckout,
  extractSubscription,
  type ParsedBillingEvent,
  type SubscriptionSnapshot,
} from './billing.events.js';

interface SubscriptionRow {
  id: string;
  creator_id: string;
  plan: string;
  period: string;
  status: string;
  provider_checkout_id: string | null;
  provider_subscription_id: string | null;
  current_period_end: string | null;
  started_at: string | null;
  pending_plan?: string | null;
  pending_period?: string | null;
}

function billingUnavailable(): ReturnType<typeof createAppError> {
  return createAppError(
    'BILLING_UNAVAILABLE',
    'Não conseguimos iniciar o pagamento agora. Tente novamente em instantes.',
    503,
  );
}

async function invalidateCreatorCache(creatorId: string): Promise<void> {
  const { data } = await supabaseAdmin.from('creators').select('user_id').eq('id', creatorId).maybeSingle();
  const userId = (data as { user_id?: string } | null)?.user_id;
  if (userId) invalidateMeCache(userId);
}

export interface BillingUsage {
  kits_total: number;
  kits_month: number;
  kits_limit: number;
  kits_limit_period: 'month';
  searches_today: number;
  searches_limit: number | null;
}

export interface SubscriptionSummary {
  enabled: true;
  plan: string;
  plan_label: string;
  status: string;
  period: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  has_active_subscription: boolean;
  pending_plan: string | null;
  pending_plan_label: string | null;
  pending_period: string | null;
  limits: PlanLimits;
  usage: BillingUsage;
}

async function getUsage(userId: string, creator: Creator): Promise<BillingUsage> {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const [totalRes, monthRes, usageRes] = await Promise.all([
    supabaseAdmin.from('content_kits').select('id', { count: 'exact', head: true }).eq('creator_id', creator.id),
    supabaseAdmin
      .from('content_kits')
      .select('id', { count: 'exact', head: true })
      .eq('creator_id', creator.id)
      .gte('criado_em', monthStart),
    supabaseAdmin
      .from('ai_usage_daily')
      .select('assistant_calls')
      .eq('user_id', userId)
      .eq('usage_date', now.toISOString().slice(0, 10))
      .maybeSingle(),
  ]);
  const { limits } = planContextForCreator(creator);
  return {
    kits_total: totalRes.count ?? 0,
    kits_month: monthRes.count ?? 0,
    kits_limit: limits.kitsPerMonth ?? 0,
    kits_limit_period: 'month' as const,
    searches_today: (usageRes.data as { assistant_calls?: number } | null)?.assistant_calls ?? 0,
    searches_limit: limits.searchesPerDay,
  };
}

export async function getSubscriptionSummary(
  userId: string,
  creator: Creator,
): Promise<SubscriptionSummary | { enabled: false }> {
  if (!billingActive()) return { enabled: false };
  const { plan, limits } = planContextForCreator(creator);
  const { data: activeRow } = await supabaseAdmin
    .from('subscriptions')
    .select('id, status, pending_plan, pending_period, provider_subscription_id')
    .eq('creator_id', creator.id)
    .in('status', ['active', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const pending = activeRow as
    | { pending_plan?: string | null; pending_period?: string | null; provider_subscription_id?: string | null }
    | null;
  return {
    enabled: true,
    plan,
    plan_label: planLabel(plan),
    status: creator.plan_status ?? 'inactive',
    period: creator.plan_period ?? null,
    trial_ends_at: creator.trial_ends_at ?? null,
    current_period_end: creator.current_period_end ?? null,
    cancel_at_period_end: creator.cancel_at_period_end === true,
    has_active_subscription: Boolean(pending?.provider_subscription_id),
    pending_plan: pending?.pending_plan ?? null,
    pending_plan_label: pending?.pending_plan ? planLabel(pending.pending_plan) : null,
    pending_period: pending?.pending_period ?? null,
    limits,
    usage: await getUsage(userId, creator),
  };
}

export async function startCheckout(
  _userId: string,
  creator: Creator,
  plan: PaidPlanId,
  period: PlanPeriod,
): Promise<{ url: string }> {
  if (!billingActive()) {
    throw createAppError('BILLING_DISABLED', 'Pagamentos indisponíveis no momento.', 503);
  }
  const { data: existingSubscription, error: existingError } = await supabaseAdmin
    .from('subscriptions')
    .select('id')
    .eq('creator_id', creator.id)
    .in('status', ['active', 'past_due'])
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existingSubscription) {
    throw Errors.BAD_REQUEST('Você já possui uma assinatura. Use a opção de trocar plano na sua conta.');
  }
  const base = env.FRONTEND_URL.replace(/\/$/, '');
  const returnUrl = `${base}/app/conta`;
  const completionUrl = `${base}/app/conta?checkout=ok`;

  const productId = productIdFor(plan, period);
  const meta = PLAN_META[plan];
  const amountCents = period === 'annual' ? meta.precoAnualCents : meta.precoMensalCents;
  if (!productId || amountCents === null) throw Errors.BAD_REQUEST('Plano indisponível.');

  const { data: row, error } = await supabaseAdmin
    .from('subscriptions')
    .insert({
      creator_id: creator.id,
      plan,
      period,
      status: 'pending',
      amount_cents: amountCents,
    })
    .select('id')
    .single();
  if (error || !row) {
    logger.error({ err: error }, 'Failed to create pending subscription');
    throw billingUnavailable();
  }

  const checkout = await createSubscriptionCheckout({
    productId,
    externalId: (row as { id: string }).id,
    returnUrl,
    completionUrl,
  });
  if (!checkout) {
    void supabaseAdmin
      .from('subscriptions')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', (row as { id: string }).id)
      .then(() => undefined);
    throw billingUnavailable();
  }

  await supabaseAdmin
    .from('subscriptions')
    .update({ provider_checkout_id: checkout.id, updated_at: new Date().toISOString() })
    .eq('id', (row as { id: string }).id);

  logger.info({ creator_id: creator.id, plan, period, checkout_id: checkout.id }, 'Subscription checkout created');
  return { url: checkout.url };
}

export async function cancelSubscription(
  userId: string,
  creator: Creator,
): Promise<{ ok: true; canceled_at: string }> {
  if (!billingActive()) {
    throw createAppError('BILLING_DISABLED', 'Pagamentos indisponíveis no momento.', 503);
  }
  const { data: rowData, error } = await supabaseAdmin
    .from('subscriptions')
    .select('id, provider_subscription_id, status')
    .eq('creator_id', creator.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const row = rowData as { id: string; provider_subscription_id: string | null } | null;
  if (!row) throw Errors.BAD_REQUEST('Nenhuma assinatura ativa para cancelar.');

  if (row.provider_subscription_id) {
    const canceled = await cancelSubscriptionAtProvider(row.provider_subscription_id);
    if (!canceled) throw billingUnavailable();
  }

  const now = new Date().toISOString();
  await supabaseAdmin
    .from('subscriptions')
    .update({ status: 'canceled', canceled_at: now, updated_at: now })
    .eq('id', row.id);
  // Mantém o acesso até o fim do período pago (effectivePlan decide).
  await supabaseAdmin
    .from('creators')
    .update({ cancel_at_period_end: true, plan_status: 'canceled' })
    .eq('id', creator.id);
  invalidateMeCache(userId);
  logger.info({ creator_id: creator.id }, 'Subscription canceled (access kept until period end)');
  return { ok: true, canceled_at: now };
}

/** Agenda a troca de plano (upgrade/downgrade) para o próximo ciclo — sem pró-rata. */
export async function schedulePlanChange(
  creator: Creator,
  plan: PaidPlanId,
  period: PlanPeriod,
): Promise<{ scheduled: true; effective_at: string | null; plan: PaidPlanId; period: PlanPeriod }> {
  if (!billingActive()) {
    throw createAppError('BILLING_DISABLED', 'Pagamentos indisponíveis no momento.', 503);
  }
  const { data: rowData, error } = await supabaseAdmin
    .from('subscriptions')
    .select('id, plan, period, provider_subscription_id, current_period_end')
    .eq('creator_id', creator.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const row = rowData as
    | { id: string; plan: string; period: string; provider_subscription_id: string | null; current_period_end: string | null }
    | null;
  if (!row?.provider_subscription_id) {
    throw Errors.BAD_REQUEST('Nenhuma assinatura ativa. Escolha um plano para assinar.');
  }
  if (row.plan === plan && row.period === period) {
    throw Errors.BAD_REQUEST('Você já assina este plano.');
  }
  if (row.period !== period) {
    throw Errors.BAD_REQUEST('A troca de plano precisa manter o ciclo de cobrança atual.');
  }
  const productId = productIdFor(plan, period);
  if (!productId) throw Errors.BAD_REQUEST('Plano indisponível.');
  const scheduledOk = await changeSubscriptionPlanAtProvider(row.provider_subscription_id, productId);
  if (!scheduledOk) throw billingUnavailable();
  const now = new Date().toISOString();
  await supabaseAdmin
    .from('subscriptions')
    .update({ pending_plan: plan, pending_period: period, updated_at: now })
    .eq('id', row.id);
  // A troca é aplicada no próximo ciclo (webhook subscription.renewed).
  logger.info({ creator_id: creator.id, plan, period, effective_at: row.current_period_end }, 'Plan change scheduled');
  return { scheduled: true, effective_at: row.current_period_end, plan, period };
}

async function findSubscriptionRow(filters: {
  checkoutId?: string | null;
  providerSubscriptionId?: string | null;
}): Promise<SubscriptionRow | null> {
  const select = 'id, creator_id, plan, period, status, provider_checkout_id, provider_subscription_id, current_period_end, started_at, pending_plan, pending_period';
  if (filters.checkoutId) {
    const { data } = await supabaseAdmin
      .from('subscriptions')
      .select(select)
      .eq('provider_checkout_id', filters.checkoutId)
      .maybeSingle();
    if (data) return data as SubscriptionRow;
  }
  if (filters.providerSubscriptionId) {
    const { data } = await supabaseAdmin
      .from('subscriptions')
      .select(select)
      .eq('provider_subscription_id', filters.providerSubscriptionId)
      .maybeSingle();
    if (data) return data as SubscriptionRow;
  }
  return null;
}

async function activateRow(
  row: SubscriptionRow,
  subscriptionId: string | null,
  trialEndsAt: string | null,
): Promise<'processed'> {
  const now = new Date().toISOString();
  const periodEnd = extendPeriodEnd(row.current_period_end, row.period);
  await supabaseAdmin
    .from('subscriptions')
    .update({
      status: 'active',
      provider_subscription_id: subscriptionId ?? row.provider_subscription_id,
      current_period_end: periodEnd,
      started_at: row.started_at ?? now,
      updated_at: now,
    })
    .eq('id', row.id);
  await supabaseAdmin
    .from('creators')
    .update({
      plan: row.plan,
      plan_status: trialEndsAt ? 'trialing' : 'active',
      plan_period: row.period,
      current_period_end: periodEnd,
      trial_ends_at: trialEndsAt,
      cancel_at_period_end: false,
    })
    .eq('id', row.creator_id);
  await invalidateCreatorCache(row.creator_id);
  logger.info({ subscription_id: row.id, plan: row.plan, creator_id: row.creator_id }, 'Subscription activated');
  return 'processed';
}

async function activateSubscription(data: Record<string, unknown>): Promise<'processed' | 'ignored'> {
  const snapshot: SubscriptionSnapshot = extractSubscription(data);
  const row = await findSubscriptionRow({
    checkoutId: snapshot.checkoutId,
    providerSubscriptionId: snapshot.subscriptionId,
  });
  if (!row) {
    logger.warn({ checkout_id: snapshot.checkoutId, subscription_id: snapshot.subscriptionId }, 'Billing event without matching subscription row');
    return 'ignored';
  }
  return activateRow(row, snapshot.subscriptionId, snapshot.trialEndsAt);
}

async function renewSubscription(data: Record<string, unknown>): Promise<'processed' | 'ignored'> {
  const snapshot = extractSubscription(data);
  const row = await findSubscriptionRow({
    providerSubscriptionId: snapshot.subscriptionId,
    checkoutId: snapshot.checkoutId,
  });
  if (!row) return 'ignored';
  const now = new Date().toISOString();
  // Troca de plano agendada (change-plan) vale a partir deste ciclo.
  const nextPlan = row.pending_plan ?? row.plan;
  const nextPeriod = row.pending_period ?? row.period;
  const periodEnd = extendPeriodEnd(row.current_period_end, nextPeriod);
  await supabaseAdmin
    .from('subscriptions')
    .update({
      status: 'active',
      plan: nextPlan,
      period: nextPeriod,
      pending_plan: null,
      pending_period: null,
      current_period_end: periodEnd,
      updated_at: now,
    })
    .eq('id', row.id);
  await supabaseAdmin
    .from('creators')
    .update({
      plan: nextPlan,
      plan_status: 'active',
      plan_period: nextPeriod,
      current_period_end: periodEnd,
      trial_ends_at: null,
      cancel_at_period_end: false,
    })
    .eq('id', row.creator_id);
  await invalidateCreatorCache(row.creator_id);
  logger.info({ subscription_id: row.id, plan: nextPlan, period_end: periodEnd }, 'Subscription renewed');
  return 'processed';
}

async function markPastDue(data: Record<string, unknown>): Promise<'processed' | 'ignored'> {
  const snapshot = extractSubscription(data);
  const row = await findSubscriptionRow({
    providerSubscriptionId: snapshot.subscriptionId,
    checkoutId: snapshot.checkoutId,
  });
  if (!row) return 'ignored';
  await supabaseAdmin.from('creators').update({ plan_status: 'past_due' }).eq('id', row.creator_id);
  await invalidateCreatorCache(row.creator_id);
  logger.warn({ subscription_id: row.id, creator_id: row.creator_id }, 'Subscription payment failed (past_due)');
  return 'processed';
}

async function markCanceled(data: Record<string, unknown>): Promise<'processed' | 'ignored'> {
  const snapshot = extractSubscription(data);
  const row = await findSubscriptionRow({
    providerSubscriptionId: snapshot.subscriptionId,
    checkoutId: snapshot.checkoutId,
  });
  if (!row) return 'ignored';
  const now = new Date().toISOString();
  await supabaseAdmin
    .from('subscriptions')
    .update({ status: 'canceled', canceled_at: now, updated_at: now })
    .eq('id', row.id);
  await supabaseAdmin
    .from('creators')
    .update({ plan_status: 'canceled', cancel_at_period_end: true })
    .eq('id', row.creator_id);
  await invalidateCreatorCache(row.creator_id);
  logger.info({ subscription_id: row.id, creator_id: row.creator_id }, 'Subscription canceled at provider');
  return 'processed';
}

/** Ativação defensiva: checkout concluído para uma assinatura ainda pendente. */
async function activateCheckout(data: Record<string, unknown>): Promise<'processed' | 'ignored'> {
  const checkout = extractCheckout(data);
  if (checkout.checkoutId) {
    const row = await findSubscriptionRow({ checkoutId: checkout.checkoutId });
    if (row && row.status === 'pending') {
      return activateRow(row, null, null);
    }
  }
  return 'ignored';
}

async function handleEvent(event: ParsedBillingEvent): Promise<'processed' | 'ignored'> {
  switch (event.type) {
    case 'subscription.completed':
    case 'subscription.trial_started':
      return activateSubscription(event.data);
    case 'subscription.renewed':
      return renewSubscription(event.data);
    case 'subscription.payment_failed':
      return markPastDue(event.data);
    case 'subscription.cancelled':
      return markCanceled(event.data);
    case 'checkout.completed':
    case 'transparent.completed':
      return activateCheckout(event.data);
    default:
      return 'ignored';
  }
}

export async function processWebhook(
  event: ParsedBillingEvent,
): Promise<'processed' | 'duplicate' | 'ignored'> {
  const { error: insertError } = await supabaseAdmin
    .from('billing_events')
    .insert({ id: event.id, type: event.type });
  if (insertError) {
    if ((insertError as { code?: string }).code === '23505') return 'duplicate';
    throw insertError;
  }
  try {
    return await handleEvent(event);
  } catch (error) {
    // Remove a marca de idempotência para permitir o retry do provedor.
    await supabaseAdmin
      .from('billing_events')
      .delete()
      .eq('id', event.id)
      .then(({ error: deleteError }) => {
        if (deleteError) logger.error({ err: deleteError }, 'Failed to rollback billing event marker');
      });
    throw error;
  }
}

// ---------- Admin (painel) ----------

export interface AdminBillingSummary {
  active: number;
  trialing: number;
  past_due: number;
  canceled: number;
  pending: number;
  failed: number;
  /** Receita recorrente mensal estimada (anual normalizado por 12). */
  mrr_cents: number;
}

function monthlyCents(amountCents: number | null, period: string): number {
  if (!amountCents) return 0;
  return period === 'annual' ? Math.round(amountCents / 12) : amountCents;
}

export async function adminBillingSummary(): Promise<AdminBillingSummary> {
  const [subsRes, trialRes] = await Promise.all([
    supabaseAdmin.from('subscriptions').select('status, period, amount_cents'),
    supabaseAdmin
      .from('creators')
      .select('id', { count: 'exact', head: true })
      .eq('plan_status', 'trialing')
      .gt('trial_ends_at', new Date().toISOString()),
  ]);
  if (subsRes.error) throw subsRes.error;
  const rows = (subsRes.data ?? []) as Array<{ status: string; period: string; amount_cents: number | null }>;
  const summary: AdminBillingSummary = {
    active: 0,
    trialing: trialRes.count ?? 0,
    past_due: 0,
    canceled: 0,
    pending: 0,
    failed: 0,
    mrr_cents: 0,
  };
  for (const row of rows) {
    if (row.status === 'active') {
      summary.active += 1;
      summary.mrr_cents += monthlyCents(row.amount_cents, row.period);
    } else if (row.status === 'past_due') summary.past_due += 1;
    else if (row.status === 'canceled') summary.canceled += 1;
    else if (row.status === 'pending') summary.pending += 1;
    else if (row.status === 'failed') summary.failed += 1;
  }
  return summary;
}

export interface AdminSubscriptionView {
  id: string;
  plan: string;
  plan_label: string;
  period: string;
  status: string;
  amount_cents: number | null;
  current_period_end: string | null;
  pending_plan: string | null;
  pending_plan_label: string | null;
  created_at: string;
  creator_id: string;
  creator_nome: string | null;
  creator_email: string | null;
}

export async function adminListSubscriptions(query: { page: number; limit: number }): Promise<{
  items: AdminSubscriptionView[];
  total: number;
  page: number;
  limit: number;
}> {
  const from = (query.page - 1) * query.limit;
  const { data, error, count } = await supabaseAdmin
    .from('subscriptions')
    .select('id, creator_id, plan, period, status, amount_cents, current_period_end, pending_plan, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + query.limit - 1);
  if (error) throw error;
  const rows = (data ?? []) as Array<{
    id: string;
    creator_id: string;
    plan: string;
    period: string;
    status: string;
    amount_cents: number | null;
    current_period_end: string | null;
    pending_plan: string | null;
    created_at: string;
  }>;
  const creatorIds = [...new Set(rows.map((row) => row.creator_id))];
  let userIdByCreator = new Map<string, string>();
  if (creatorIds.length > 0) {
    const { data: creators, error: creatorsError } = await supabaseAdmin
      .from('creators')
      .select('id, user_id')
      .in('id', creatorIds);
    if (creatorsError) throw creatorsError;
    userIdByCreator = new Map(
      ((creators ?? []) as Array<{ id: string; user_id: string }>).map((row) => [row.id, row.user_id]),
    );
  }
  const directory = await listUserDirectory();
  const items: AdminSubscriptionView[] = rows.map((row) => {
    const userId = userIdByCreator.get(row.creator_id);
    const user = userId ? directory.get(userId) : undefined;
    return {
      id: row.id,
      plan: row.plan,
      plan_label: planLabel(row.plan),
      period: row.period,
      status: row.status,
      amount_cents: row.amount_cents,
      current_period_end: row.current_period_end,
      pending_plan: row.pending_plan,
      pending_plan_label: row.pending_plan ? planLabel(row.pending_plan) : null,
      created_at: row.created_at,
      creator_id: row.creator_id,
      creator_nome: user?.nome ?? null,
      creator_email: user?.email ?? null,
    };
  });
  return { items, total: count ?? items.length, page: query.page, limit: query.limit };
}
