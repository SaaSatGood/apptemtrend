import { env } from '../../config/env.js';

export type PlanId = 'free' | 'essencial' | 'pro' | 'scale' | 'enterprise';
/** Planos que ainda podem ser contratados. Os demais seguem válidos para assinaturas antigas. */
export type PaidPlanId = 'essencial' | 'pro' | 'scale';
export type CatalogPlanId = 'pro' | 'enterprise';
export type PlanPeriod = 'monthly' | 'annual';

export interface PlanLimits {
  /** Buscas de IA por dia (planos pagos/uso justo). null = sem contagem visível. */
  searchesPerDay: number | null;
  /** Buscas de IA por semana (plano Grátis). null = não se aplica. */
  searchesPerWeek: number | null;
  /** Kits por mês (planos pagos). null = ilimitado/uso justo. */
  kitsPerMonth: number | null;
  /** Kits por semana (plano Grátis). null = não se aplica. */
  kitsPerWeek: number | null;
  variations: boolean;
  variationCooldownSeconds: number;
  vozPersonalizada: boolean;
  /** Roteiros salvos por produto. null = ilimitado. */
  kitsPerProduct: number | null;
  /** Itens na área Produção. null = ilimitado. */
  productionItems: number | null;
}

export interface PlanMeta {
  id: CatalogPlanId;
  nome: string;
  resumo: string;
  precoMensalCents: number | null;
  precoAnualCents: number | null;
  precoLancamentoMensalCents: number | null;
  precoLancamentoAnualCents: number | null;
  bullets: string[];
  destaque: boolean;
}

/**
 * Plano Grátis: dá espaço para o usuário viver o
 * primeiro valor (roteiro pronto) e voltar mais algumas vezes antes do
 * paywall, sem transformar a conta gratuita em um plano de uso contínuo.
 */
export const FREE_SEARCHES_PER_WEEK: number = 100;
export const FREE_KITS_PER_WEEK: number = 10;

/**
 * Teto interno de uso justo. Não aparece na tabela de planos: a comunicação é
 * "ilimitado com uso justo" e o limite só é aplicado contra abuso (conta
 * compartilhada, automação ou revenda). Ao atingir, a conversa é comercial.
 */
export const FAIR_USE_KITS_PER_MONTH = 1_000;

/**
 * Uso justo de buscas no Pro: teto diário alto o bastante para não aparecer na
 * experiência normal, mas finito contra automação/revenda. Não é vendido como
 * número — a comunicação é "ilimitado com uso justo".
 */
export const FAIR_USE_SEARCHES_PER_DAY = 1_000;

export const LAUNCH_SEATS = 100;
export const LAUNCH_MONTHLY_CENTS = 3_990;
export const LAUNCH_ANNUAL_CENTS = 39_900;
/** Novas vendas usam o preço cheio. Assinantes antigos de lançamento seguem
 *  com o valor herdado na renovação. */
export const LAUNCH_OFFER_ENABLED = false;
export const PRO_MONTHLY_CENTS = 4_990;
export const PRO_ANNUAL_CENTS = 49_900;

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  // Grátis: buscas e roteiros renovam juntos toda segunda-feira.
  free: {
    searchesPerDay: null,
    searchesPerWeek: FREE_SEARCHES_PER_WEEK,
    kitsPerMonth: null,
    kitsPerWeek: FREE_KITS_PER_WEEK,
    variations: false,
    variationCooldownSeconds: 0,
    vozPersonalizada: false,
    // Variações continuam exclusivas do Pro: 1 roteiro por produto.
    kitsPerProduct: 1,
    productionItems: 1,
  },
  // Planos antigos: mantidos para assinaturas legadas. Não são vendidos.
  essencial: {
    searchesPerDay: null,
    searchesPerWeek: null,
    kitsPerMonth: null,
    kitsPerWeek: null,
    variations: true,
    variationCooldownSeconds: 60,
    vozPersonalizada: true,
    kitsPerProduct: null,
    productionItems: null,
  },
  pro: {
    searchesPerDay: null,
    searchesPerWeek: null,
    kitsPerMonth: null,
    kitsPerWeek: null,
    variations: true,
    variationCooldownSeconds: 30,
    vozPersonalizada: true,
    kitsPerProduct: null,
    productionItems: null,
  },
  scale: {
    searchesPerDay: null,
    searchesPerWeek: null,
    kitsPerMonth: null,
    kitsPerWeek: null,
    variations: true,
    variationCooldownSeconds: 30,
    vozPersonalizada: true,
    kitsPerProduct: null,
    productionItems: null,
  },
  enterprise: {
    searchesPerDay: null,
    searchesPerWeek: null,
    kitsPerMonth: null,
    kitsPerWeek: null,
    variations: true,
    variationCooldownSeconds: 30,
    vozPersonalizada: true,
    kitsPerProduct: null,
    productionItems: null,
  },
};

export const PLAN_LABELS: Record<PlanId, string> = {
  free: 'Grátis',
  essencial: 'Essencial',
  pro: 'Pro',
  scale: 'Scale',
  enterprise: 'Enterprise',
};

export const PLAN_META: Record<CatalogPlanId, PlanMeta> = {
  pro: {
    id: 'pro',
    nome: 'Pro',
    resumo: 'Para criar sem contar roteiros',
    precoMensalCents: PRO_MONTHLY_CENTS,
    precoAnualCents: PRO_ANNUAL_CENTS,
    precoLancamentoMensalCents: PRO_MONTHLY_CENTS,
    precoLancamentoAnualCents: PRO_ANNUAL_CENTS,
    bullets: [
      'Roteiros ilimitados',
      'Buscas de IA ilimitadas',
      'Catálogo completo de produtos',
      'Variações do roteiro quando quiser',
      'Voz personalizada no roteiro',
      'Roteiros salvos e produção sem teto',
      'Suporte interno na plataforma',
    ],
    destaque: true,
  },
  enterprise: {
    id: 'enterprise',
    nome: 'Enterprise',
    resumo: 'Para operações com necessidades específicas',
    precoMensalCents: null,
    precoAnualCents: null,
    precoLancamentoMensalCents: null,
    precoLancamentoAnualCents: null,
    bullets: [
      'Condições definidas em conversa',
      'Avaliação do seu volume de criação',
      'Integração com o seu fluxo de trabalho',
    ],
    destaque: false,
  },
};

// Produtos criados na loja AbacatePay. IDs podem ser sobrescritos por env sem
// novo deploy de código.
const PRODUCTS = {
  pro_monthly: env.ABACATEPAY_PRODUCT_PRO_MENSAL ?? 'prod_Jt2hbA4rBeCeGrbaPsUUEccb',
  pro_annual: env.ABACATEPAY_PRODUCT_PRO_ANUAL ?? 'prod_xR2MWUbe1AkdHqjK5EN6yPpJ',
  pro_monthly_pix: env.ABACATEPAY_PRODUCT_PRO_MENSAL_PIX ?? 'prod_XxNqutEGTfFTs4QHxf2WtbpA',
  pro_annual_pix: env.ABACATEPAY_PRODUCT_PRO_ANUAL_PIX ?? 'prod_SeQfXsLnBUxnZ0bBstzXZUE5',
  launch_monthly: env.ABACATEPAY_PRODUCT_LAUNCH_MENSAL ?? 'prod_X35W1dnyXLA055ZewPZG6gMK',
  launch_annual: env.ABACATEPAY_PRODUCT_LAUNCH_ANUAL ?? 'prod_gqppYRSSdKnHBZJKSBRpw0Jx',
  launch_monthly_pix: env.ABACATEPAY_PRODUCT_LAUNCH_MENSAL_PIX ?? 'prod_23bJx2ZaU3EsaHYLSRuL6Rt3',
  launch_annual_pix: env.ABACATEPAY_PRODUCT_LAUNCH_ANUAL_PIX ?? 'prod_XjpDTmMur4wqMQtZAJ0fGA5T',
} as const;

/** Produtos antigos, mantidos só para reconhecer assinaturas já existentes. */
const LEGACY_PRODUCTS = {
  essencial_monthly: env.ABACATEPAY_PRODUCT_ESSENCIAL_MENSAL ?? 'prod_2hdyBwYWdbumAwpyYKkBFqkd',
  essencial_annual: env.ABACATEPAY_PRODUCT_ESSENCIAL_ANUAL ?? 'prod_1s5naWFB5UHjFqkSJJG3FWxD',
  scale_monthly: env.ABACATEPAY_PRODUCT_SCALE_MENSAL ?? 'prod_XxZmftEJaNASwcC6WzXcYmKJ',
  scale_annual: env.ABACATEPAY_PRODUCT_SCALE_ANUAL ?? 'prod_HpLjnExYMedtuqfTfGFT1GpZ',
} as const;

export type ProductKey = keyof typeof PRODUCTS;
export type LegacyProductKey = keyof typeof LEGACY_PRODUCTS;

export interface ProductSelection {
  launch?: boolean;
  mode?: 'recurring' | 'one_time';
}

export function productIdFor(
  plan: PaidPlanId,
  period: PlanPeriod,
  selection: ProductSelection = {},
): string | null {
  if (plan === 'essencial' || plan === 'scale') {
    const key = `${plan}_${period}` as LegacyProductKey;
    return LEGACY_PRODUCTS[key] ?? null;
  }
  const launch = selection.launch === true;
  const oneTime = selection.mode === 'one_time';
  const key = `${launch ? 'launch' : 'pro'}_${period}${oneTime ? '_pix' : ''}` as ProductKey;
  return PRODUCTS[key] ?? null;
}

export function planPeriodForProductId(
  productId: string | null | undefined,
): { plan: PaidPlanId; period: PlanPeriod; launch: boolean; mode: 'recurring' | 'one_time' } | null {
  if (!productId) return null;
  for (const [key, value] of Object.entries(PRODUCTS) as Array<[ProductKey, string]>) {
    if (value !== productId) continue;
    const launch = key.startsWith('launch_');
    const mode = key.endsWith('_pix') ? 'one_time' : 'recurring';
    const period = key.includes('_annual') ? 'annual' : 'monthly';
    return { plan: 'pro', period, launch, mode };
  }
  for (const [key, value] of Object.entries(LEGACY_PRODUCTS) as Array<[LegacyProductKey, string]>) {
    if (value !== productId) continue;
    const plan = key.startsWith('essencial') ? 'essencial' : 'scale';
    const period = key.endsWith('_annual') ? 'annual' : 'monthly';
    return { plan, period, launch: false, mode: 'recurring' };
  }
  return null;
}

export function isPaidPlan(value: string): value is PaidPlanId {
  return value === 'essencial' || value === 'pro' || value === 'scale';
}

export function planLabel(plan: string): string {
  if (plan in PLAN_LABELS) return PLAN_LABELS[plan as PlanId];
  return 'Grátis';
}

export function formatCents(cents: number | null): string | null {
  if (cents === null) return null;
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
