import { env } from '../../config/env.js';
import { supabaseAdmin } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';
import { AI_QUOTA } from '../../lib/ai-metrics.js';
import { createAppError, type AppError, type Creator } from '../../types/index.js';
import { PLAN_LIMITS, planLabel, type PaidPlanId, type PlanId, type PlanLimits } from './plans.js';

/**
 * Gating por plano. Tudo aqui é no-op quando o billing está desligado
 * (BILLING_ENABLED=false ou sem chave): o app continua com as cotas globais
 * atuais — nenhuma regressão para quem já usa.
 */

export function billingActive(): boolean {
  return env.BILLING_ENABLED === true && Boolean(env.ABACATEPAY_API_KEY);
}

type PlanStateFields = Pick<Creator, 'plan' | 'plan_status' | 'trial_ends_at' | 'current_period_end'>;

export function effectivePlan(creator: PlanStateFields): PlanId {
  const raw = creator.plan ?? 'free';
  const plan = (raw in PLAN_LIMITS ? raw : 'free') as PlanId;
  if (plan === 'free') return 'free';
  const now = Date.now();
  const ts = (value?: string | null) => {
    if (!value) return 0;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  switch (creator.plan_status) {
    case 'active':
      return ts(creator.current_period_end) > now ? plan : 'free';
    case 'trialing':
      return ts(creator.trial_ends_at) > now ? plan : 'free';
    case 'past_due':
    case 'canceled':
      // Cancelou ou falhou pagamento: mantém o acesso até o fim do período pago.
      return ts(creator.current_period_end) > now ? plan : 'free';
    default:
      return 'free';
  }
}

export function planContextForCreator(creator: Creator): { plan: PlanId; limits: PlanLimits } {
  const plan = billingActive() ? effectivePlan(creator) : 'free';
  return { plan, limits: PLAN_LIMITS[plan] };
}

export function planLimitError(message: string): AppError {
  return createAppError('PLAN_LIMIT', message, 402);
}

// Dica de upgrade por plano: "no próximo degrau são N — e você mantém tudo".
const NEXT_PLAN: Partial<Record<PlanId, PaidPlanId>> = {
  free: 'essencial',
  essencial: 'pro',
  pro: 'scale',
};

export function kitUpgradeHint(plan: PlanId): string {
  const next = NEXT_PLAN[plan];
  if (!next) return '';
  const nextLimit = PLAN_LIMITS[next].kitsPerMonth;
  return nextLimit ? ` No ${planLabel(next)} são ${nextLimit} roteiros por mês — e você mantém tudo o que já fez.` : '';
}

export function searchUpgradeHint(plan: PlanId): string {
  const next = NEXT_PLAN[plan];
  if (!next) return '';
  const nextLimit = PLAN_LIMITS[next].searchesPerDay;
  return nextLimit ? ` No ${planLabel(next)} são ${nextLimit} buscas por dia.` : '';
}

export function productionUpgradeHint(plan: PlanId): string {
  const next = NEXT_PLAN[plan];
  if (!next) return '';
  const nextLimit = PLAN_LIMITS[next].productionItems;
  return nextLimit
    ? ` No ${planLabel(next)} são ${nextLimit} itens.`
    : ` No ${planLabel(next)} a produção é ilimitada.`;
}

export function startOfMonthIso(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export async function countKits(creatorId: string, sinceIso?: string): Promise<number> {
  let query = supabaseAdmin
    .from('content_kits')
    .select('id', { count: 'exact', head: true })
    .eq('creator_id', creatorId);
  if (sinceIso) query = query.gte('criado_em', sinceIso);
  const { count, error } = await query;
  if (error) {
    logger.error({ err: error }, 'Failed to count content kits for plan gating');
    throw error;
  }
  return count ?? 0;
}

async function countKitsForProduct(creatorId: string, productId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('content_kits')
    .select('id', { count: 'exact', head: true })
    .eq('creator_id', creatorId)
    .eq('product_id', productId);
  if (error) {
    logger.error({ err: error }, 'Failed to count product kits for plan gating');
    throw error;
  }
  return count ?? 0;
}

export async function countProductionItems(creatorId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('creator_content')
    .select('id', { count: 'exact', head: true })
    .eq('creator_id', creatorId);
  if (error) {
    logger.error({ err: error }, 'Failed to count production items for plan gating');
    throw error;
  }
  return count ?? 0;
}

/** Kits: pagos = cota mensal; sem plano (free) = 0 novos. Com `reusableProductId`,
 *  permite reutilizar um kit já existente do produto (navegar roteiros salvos
 *  nunca é bloqueado). */
export async function assertKitQuota(creator: Creator, reusableProductId?: string): Promise<void> {
  if (!billingActive()) return;
  const { plan, limits } = planContextForCreator(creator);
  if (reusableProductId && (await countKitsForProduct(creator.id, reusableProductId)) > 0) return;
  if (plan === 'free') {
    throw planLimitError(
      `Sua conta está sem plano ativo — assine para criar novos roteiros. Tudo o que você já fez continua salvo.${kitUpgradeHint('free')}`,
    );
  }
  if (limits.kitsPerMonth === null) return;
  const allowed = limits.kitsPerMonth;
  const used = await countKits(creator.id, startOfMonthIso());
  if (used < allowed) return;
  throw planLimitError(
    `Você já criou ${used} de ${allowed} roteiros do plano ${planLabel(plan)}. Faça upgrade para criar mais.${kitUpgradeHint(plan)}`,
  );
}

export interface VariationsPolicy {
  allowed: boolean;
  cooldownMs: number;
}

export function variationsPolicy(creator: Creator): VariationsPolicy {
  if (!billingActive()) return { allowed: true, cooldownMs: AI_QUOTA.FORCE_NEW_COOLDOWN_MS };
  const { limits } = planContextForCreator(creator);
  return { allowed: limits.variations, cooldownMs: Math.max(1_000, limits.variationCooldownSeconds * 1_000) };
}

/** Roteiros salvos por produto (aplicado antes de criar uma nova versão). */
export async function assertVariationQuota(creator: Creator, productId: string): Promise<void> {
  if (!billingActive()) return;
  const { plan, limits } = planContextForCreator(creator);
  if (plan === 'free') {
    throw planLimitError(
      `Sua conta está sem plano ativo — assine para salvar novas versões de roteiro.${kitUpgradeHint('free')}`,
    );
  }
  if (limits.kitsPerProduct === null) return;
  const used = await countKitsForProduct(creator.id, productId);
  if (used >= limits.kitsPerProduct) {
    throw planLimitError(
      `Seu plano ${planLabel(plan)} salva até ${limits.kitsPerProduct} roteiro(s) por produto. Faça upgrade para salvar mais versões.`,
    );
  }
}

export function vozPersonalizadaAllowed(creator: Creator): boolean {
  if (!billingActive()) return true;
  return planContextForCreator(creator).limits.vozPersonalizada;
}

/** Itens na área Produção (creator_content). */
export async function assertProductionQuota(creator: Creator): Promise<void> {
  if (!billingActive()) return;
  const { plan, limits } = planContextForCreator(creator);
  if (plan === 'free') {
    throw planLimitError(
      `Sua conta está sem plano ativo — assine para adicionar itens à produção.${productionUpgradeHint('free')}`,
    );
  }
  if (limits.productionItems === null) return;
  const used = await countProductionItems(creator.id);
  if (used >= limits.productionItems) {
    throw planLimitError(
      `Seu plano ${planLabel(plan)} permite ${limits.productionItems} itens na produção.${productionUpgradeHint(plan)}`,
    );
  }
}
