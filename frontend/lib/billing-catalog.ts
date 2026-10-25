import type { BillingCatalogResponse, BillingPlanMeta } from "@/lib/types";

export const PLAN_OUTCOME: Record<string, string> = {
  pro: "Crie sem contar roteiros e leve cada vídeo até a publicação.",
  enterprise: "Converse com a gente para desenhar a operação certa para o seu volume.",
};

export function planBullets(plan: BillingPlanMeta): string[] {
  return plan.bullets;
}

// Espelho do catálogo do backend para quando a API não responder.
// A disponibilidade de checkout e o preço de lançamento devem sempre vir da
// resposta da API; aqui ficam apenas os valores de referência.
export const FALLBACK_CATALOG: BillingCatalogResponse = {
  enabled: false,
  trial_days: 0,
  free: { searches_total: 3, kits_total: 3 },
  launch: null,
  plans: [
    {
      id: "pro",
      nome: "Pro",
      resumo: "Para criar sem contar roteiros",
      precoMensalCents: 4990,
      precoAnualCents: 49900,
      precoMensal: "R$ 49,90",
      precoAnual: "R$ 499,00",
      precoLancamentoMensalCents: 3990,
      precoLancamentoAnualCents: 39900,
      precoLancamentoMensal: "R$ 39,90",
      precoLancamentoAnual: "R$ 399,00",
      bullets: [
        "Kits de conteúdo ilimitados (uso justo)",
        "Buscas de IA ilimitadas (uso justo)",
        "Variações do roteiro quando quiser",
        "Voz personalizada no roteiro",
        "Roteiros salvos e produção sem teto",
        "Suporte por email",
      ],
      destaque: true,
      limits: {
        searchesPerDay: null,
        kitsPerMonth: null,
        variations: true,
        variationCooldownSeconds: 30,
        vozPersonalizada: true,
        kitsPerProduct: null,
        productionItems: null,
      },
    },
    {
      id: "enterprise",
      nome: "Enterprise",
      resumo: "Para operações com necessidades específicas",
      precoMensalCents: null,
      precoAnualCents: null,
      precoMensal: null,
      precoAnual: null,
      precoLancamentoMensalCents: null,
      precoLancamentoAnualCents: null,
      precoLancamentoMensal: null,
      precoLancamentoAnual: null,
      bullets: [
        "Condições definidas em conversa",
        "Avaliação do seu volume de criação",
        "Integração com o seu fluxo de trabalho",
      ],
      destaque: false,
      limits: {
        searchesPerDay: null,
        kitsPerMonth: null,
        variations: true,
        variationCooldownSeconds: 30,
        vozPersonalizada: true,
        kitsPerProduct: null,
        productionItems: null,
      },
    },
  ],
};
