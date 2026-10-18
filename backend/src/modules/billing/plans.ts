import { env } from '../../config/env.js';

export type PlanId = 'free' | 'essencial' | 'pro' | 'scale' | 'enterprise';
export type PaidPlanId = 'essencial' | 'pro' | 'scale';
/** Planos exibidos no catálogo público (pagos + enterprise). */
export type CatalogPlanId = 'essencial' | 'pro' | 'scale' | 'enterprise';
export type PlanPeriod = 'monthly' | 'annual';

export interface PlanLimits {
  /** Buscas de IA por dia. null = fair use (usa o teto global). */
  searchesPerDay: number | null;
  /** Kits por mês. Em 'free' (sem plano) é 0 — a jornada é trial → assinatura. */
  kitsPerMonth: number | null;
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
  bullets: string[];
  destaque: boolean;
}

export const TRIAL_DAYS = 7;

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  // 'free' = sem plano ativo (pós-trial ou nunca assinou): sem novo uso.
  // A jornada é trial de 7 dias de Pro → assinatura.
  free: {
    searchesPerDay: 0,
    kitsPerMonth: 0,
    variations: false,
    variationCooldownSeconds: 0,
    vozPersonalizada: false,
    kitsPerProduct: 0,
    productionItems: 0,
  },
  essencial: {
    searchesPerDay: 50,
    kitsPerMonth: 30,
    variations: true,
    variationCooldownSeconds: 60,
    vozPersonalizada: true,
    kitsPerProduct: 5,
    productionItems: 50,
  },
  pro: {
    searchesPerDay: 200,
    kitsPerMonth: 100,
    variations: true,
    variationCooldownSeconds: 30,
    vozPersonalizada: true,
    kitsPerProduct: null,
    productionItems: null,
  },
  scale: {
    searchesPerDay: 500,
    kitsPerMonth: 300,
    variations: true,
    variationCooldownSeconds: 30,
    vozPersonalizada: true,
    kitsPerProduct: null,
    productionItems: null,
  },
  enterprise: {
    searchesPerDay: null,
    kitsPerMonth: 1000,
    variations: true,
    variationCooldownSeconds: 30,
    vozPersonalizada: true,
    kitsPerProduct: null,
    productionItems: null,
  },
};

export const PLAN_META: Record<CatalogPlanId, PlanMeta> = {
  essencial: {
    id: 'essencial',
    nome: 'Essencial',
    resumo: 'Para o creator iniciante',
    precoMensalCents: 2990,
    precoAnualCents: 29900,
    bullets: [
      '30 kits de conteúdo por mês',
      '50 buscas de IA por dia',
      'Variações do roteiro (a cada 60s)',
      'Voz personalizada no roteiro',
      '5 roteiros salvos por produto',
      '50 itens na produção',
    ],
    destaque: false,
  },
  pro: {
    id: 'pro',
    nome: 'Pro',
    resumo: 'Para o creator ativo',
    precoMensalCents: 5990,
    precoAnualCents: 59900,
    bullets: [
      '100 kits de conteúdo por mês',
      '200 buscas de IA por dia',
      'Variações do roteiro (a cada 30s)',
      'Roteiros salvos ilimitados',
      'Produção ilimitada',
      'Suporte prioritário em 24h',
    ],
    destaque: true,
  },
  scale: {
    id: 'scale',
    nome: 'Scale',
    resumo: 'Para duplas e agências',
    precoMensalCents: 14900,
    precoAnualCents: 149000,
    bullets: [
      '300 kits de conteúdo por mês',
      '500 buscas de IA por dia',
      '3 assentos',
      'Suporte dedicado',
      'Exportação CSV',
    ],
    destaque: false,
  },
  enterprise: {
    id: 'enterprise',
    nome: 'Enterprise',
    resumo: 'Para operações maiores',
    precoMensalCents: null,
    precoAnualCents: null,
    bullets: ['Fair use de 1.000 kits/mês', 'Buscas de IA ilimitadas (fair use)', '10+ assentos', 'SLA e onboarding assistido'],
    destaque: false,
  },
};

// Produtos criados na loja AbacatePay (item 11 do relatório). IDs podem ser
// sobrescritos por env sem novo deploy de código.
const PRODUCT_IDS = {
  essencial_monthly: env.ABACATEPAY_PRODUCT_ESSENCIAL_MENSAL ?? 'prod_2hdyBwYWdbumAwpyYKkBFqkd',
  essencial_annual: env.ABACATEPAY_PRODUCT_ESSENCIAL_ANUAL ?? 'prod_1s5naWFB5UHjFqkSJJG3FWxD',
  pro_monthly: env.ABACATEPAY_PRODUCT_PRO_MENSAL ?? 'prod_p4cS64H2MtnhrrU4YjBCDmKp',
  pro_annual: env.ABACATEPAY_PRODUCT_PRO_ANUAL ?? 'prod_f1hLdGkZnkmfu4ab2Pu4Jrt5',
  scale_monthly: env.ABACATEPAY_PRODUCT_SCALE_MENSAL ?? 'prod_XxZmftEJaNASwcC6WzXcYmKJ',
  scale_annual: env.ABACATEPAY_PRODUCT_SCALE_ANUAL ?? 'prod_HpLjnExYMedtuqfTfGFT1GpZ',
} as const;

export type ProductKey = keyof typeof PRODUCT_IDS;

export function productKeyFor(plan: PaidPlanId, period: PlanPeriod): ProductKey {
  return `${plan}_${period}` as ProductKey;
}

export function productIdFor(plan: PaidPlanId, period: PlanPeriod): string | null {
  return PRODUCT_IDS[productKeyFor(plan, period)] ?? null;
}

export function planPeriodForProductId(productId: string | null | undefined): { plan: PaidPlanId; period: PlanPeriod } | null {
  if (!productId) return null;
  for (const plan of ['essencial', 'pro', 'scale'] as const) {
    for (const period of ['monthly', 'annual'] as const) {
      if (PRODUCT_IDS[productKeyFor(plan, period)] === productId) return { plan, period };
    }
  }
  return null;
}

export function planLabel(plan: string): string {
  if (plan in PLAN_META) return PLAN_META[plan as CatalogPlanId].nome;
  return 'Sem plano';
}

export function formatCents(cents: number | null): string | null {
  if (cents === null) return null;
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
