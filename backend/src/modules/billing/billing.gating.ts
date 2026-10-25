import { env } from '../../config/env.js';
import { supabaseAdmin } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';
import { AI_QUOTA } from '../../lib/ai-metrics.js';
import { createAppError, type AppError, type Creator } from '../../types/index.js';
import { PLAN_LIMITS, FAIR_USE_KITS_PER_MONTH, FREE_KITS_TOTAL, planLabel, type PaidPlanId, type PlanId, type PlanLimits } from './plans.js';

/**
 * Gating por plano. Tudo aqui é no-op quando o billing está desligado
 * (BILLING_ENABLED=false ou sem chave): o app continua com as cotas globais
 * atuais — nenhuma regressão para quem já usa.
 */

export function billingActive(): boolean {
  // Nunca cria cobranças reais durante a suíte de testes, mesmo com .env local preenchido.
  if (env.NODE_ENV === 'test') return false;
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
      // Trials antigos não concedem mais acesso Pro.
      return 'free';
    case 'past_due':
    case 'canceled':
      // Cancelou ou falhou pagamento: mantém o acesso até o fim do período pago.
      return ts(creator.current_period_end) > now ? plan : 'free';
    default:
      return 'free';
  }
}

export function planContextForCreator(creator: Creator): { plan: PlanId; limits: PlanLimits } {
  const plan = effectivePlan(creator);
  return { plan, limits: PLAN_LIMITS[plan] };
}

export function planLimitError(message: string): AppError {
  return createAppError('PLAN_LIMIT', message, 402);
}

// Dica de upgrade por plano: hoje existe um único plano pago (Pro). Mantemos
// os planos antigos apenas para assinaturas legadas.
const NEXT_PLAN: Partial<Record<PlanId, PaidPlanId>> = {
  free: 'pro',
  essencial: 'pro',
};

export function kitUpgradeHint(plan: PlanId): string {
  const next = NEXT_PLAN[plan];
  if (!next) return '';
  const nextLimit = PLAN_LIMITS[next].kitsPerMonth;
  return nextLimit ? ` No ${planLabel(next)} são ${nextLimit} roteiros por mês — e você mantém tudo o que já fez.` : ` Assine ${planLabel(next)} para continuar criando com uso justo.`;
}

export function searchUpgradeHint(plan: PlanId): string {
  const next = NEXT_PLAN[plan];
  if (!next) return '';
  const nextLimit = PLAN_LIMITS[next].searchesPerDay;
  return nextLimit ? ` No ${planLabel(next)} são ${nextLimit} buscas por dia.` : ` Assine ${planLabel(next)} para continuar buscando com uso justo.`;
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

/** Kits: Grátis = 3 por conta; pagos = ilimitado com uso justo.
 *  O número do uso justo não é exposto na tabela de planos — quando o teto é
 *  atingido, o contato vira conversa comercial. Com `reusableProductId`,
 *  permite reutilizar um kit já existente do produto (navegar roteiros salvos
 *  nunca é bloqueado). */
export async function assertKitQuota(creator: Creator, reusableProductId?: string): Promise<void> {
  const { plan, limits } = planContextForCreator(creator);
  if (reusableProductId && (await countKitsForProduct(creator.id, reusableProductId)) > 0) return;
  if (plan === 'free') {
    if (await countKits(creator.id) < FREE_KITS_TOTAL) return;
    throw planLimitError(
      `Você usou os ${FREE_KITS_TOTAL} roteiros do plano Grátis. Tudo o que criou continua salvo.${kitUpgradeHint('free')}`,
    );
  }
  if (!billingActive()) return;
  const used = await countKits(creator.id, startOfMonthIso());
  const planCap = limits.kitsPerMonth ?? FAIR_USE_KITS_PER_MONTH;
  if (used < planCap) return;
  throw planLimitError(
    'Você atingiu o limite de uso justo deste mês. Fale com a gente para ajustar seu plano e continuar criando.',
  );
}

export interface VariationsPolicy {
  allowed: boolean;
  cooldownMs: number;
}

export function variationsPolicy(creator: Creator): VariationsPolicy {
  const { plan, limits } = planContextForCreator(creator);
  if (plan !== 'free' && !billingActive()) return { allowed: true, cooldownMs: AI_QUOTA.FORCE_NEW_COOLDOWN_MS };
  return { allowed: limits.variations, cooldownMs: Math.max(1_000, limits.variationCooldownSeconds * 1_000) };
}

/** Roteiros salvos por produto (aplicado antes de criar uma nova versão). */
export async function assertVariationQuota(creator: Creator, productId: string): Promise<void> {
  const { plan, limits } = planContextForCreator(creator);
  if (plan === 'free') {
    throw planLimitError(
      `Novas versões de roteiro estão disponíveis no Pro.${kitUpgradeHint('free')}`,
    );
  }
  if (!billingActive()) return;
  if (limits.kitsPerProduct === null) return;
  const used = await countKitsForProduct(creator.id, productId);
  if (used >= limits.kitsPerProduct) {
    throw planLimitError(
      `Seu plano ${planLabel(plan)} salva até ${limits.kitsPerProduct} roteiro(s) por produto. Faça upgrade para salvar mais versões.`,
    );
  }
}

export function vozPersonalizadaAllowed(creator: Creator): boolean {
  if (effectivePlan(creator) === 'free') return false;
  if (!billingActive()) return true;
  return planContextForCreator(creator).limits.vozPersonalizada;
}

/** Itens na área Produção (creator_content). */
export async function assertProductionQuota(creator: Creator): Promise<void> {
  const { plan, limits } = planContextForCreator(creator);
  if (plan !== 'free' && !billingActive()) return;
  if (limits.productionItems === null) return;
  const used = await countProductionItems(creator.id);
  if (used >= limits.productionItems) {
    throw planLimitError(
      `Seu plano ${planLabel(plan)} permite ${limits.productionItems} itens na produção.${productionUpgradeHint(plan)}`,
    );
  }
}
