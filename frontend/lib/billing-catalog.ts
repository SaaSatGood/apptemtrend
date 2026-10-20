import type { BillingCatalogResponse } from "@/lib/types";

// Espelho do catálogo do backend para quando a API não responder.
// A disponibilidade de checkout deve sempre vir da resposta da API.
export const FALLBACK_CATALOG: BillingCatalogResponse = {
  enabled: false,
  trial_days: 7,
  plans: [
    {
      id: "essencial", nome: "Essencial", resumo: "Para o creator iniciante",
      precoMensalCents: 2990, precoAnualCents: 29900, precoMensal: "R$ 29,90", precoAnual: "R$ 299,00",
      bullets: ["30 kits de conteúdo por mês", "50 buscas de IA por dia", "Variações do roteiro (a cada 60s)", "Voz personalizada no roteiro", "5 roteiros salvos por produto", "50 itens na produção"],
      destaque: false,
      limits: { searchesPerDay: 50, kitsPerMonth: 30, variations: true, variationCooldownSeconds: 60, vozPersonalizada: true, kitsPerProduct: 5, productionItems: 50 },
    },
    {
      id: "pro", nome: "Pro", resumo: "Para o creator ativo",
      precoMensalCents: 5990, precoAnualCents: 59900, precoMensal: "R$ 59,90", precoAnual: "R$ 599,00",
      bullets: ["100 kits de conteúdo por mês", "200 buscas de IA por dia", "Variações do roteiro (a cada 30s)", "Roteiros salvos ilimitados", "Produção ilimitada", "Suporte prioritário em 24h"],
      destaque: true,
      limits: { searchesPerDay: 200, kitsPerMonth: 100, variations: true, variationCooldownSeconds: 30, vozPersonalizada: true, kitsPerProduct: null, productionItems: null },
    },
    {
      id: "scale", nome: "Scale", resumo: "Para duplas e agências",
      precoMensalCents: 14900, precoAnualCents: 149000, precoMensal: "R$ 149,00", precoAnual: "R$ 1.490,00",
      bullets: ["300 kits de conteúdo por mês", "500 buscas de IA por dia", "3 assentos", "Suporte dedicado", "Exportação CSV"],
      destaque: false,
      limits: { searchesPerDay: 500, kitsPerMonth: 300, variations: true, variationCooldownSeconds: 30, vozPersonalizada: true, kitsPerProduct: null, productionItems: null },
    },
    {
      id: "enterprise", nome: "Enterprise", resumo: "Para operações maiores",
      precoMensalCents: null, precoAnualCents: null, precoMensal: null, precoAnual: null,
      bullets: ["Fair use de 1.000 kits/mês", "Buscas de IA ilimitadas (fair use)", "10+ assentos", "SLA e onboarding assistido"],
      destaque: false,
      limits: { searchesPerDay: null, kitsPerMonth: 1000, variations: true, variationCooldownSeconds: 30, vozPersonalizada: true, kitsPerProduct: null, productionItems: null },
    },
  ],
};
