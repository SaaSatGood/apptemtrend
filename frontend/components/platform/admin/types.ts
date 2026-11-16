import type { IconName } from "@/components/ui/Icon";

export type AdminView =
  | "overview"
  | "products"
  | "creators"
  | "leads"
  | "billing"
  | "support"
  | "ai";

export const ADMIN_VIEWS: Array<{ key: AdminView; label: string; icon: IconName }> = [
  { key: "overview", label: "Visão geral", icon: "grid" },
  { key: "products", label: "Produtos", icon: "box" },
  { key: "creators", label: "Creators", icon: "users" },
  { key: "leads", label: "Leads", icon: "ticket" },
  { key: "billing", label: "Assinaturas", icon: "plan" },
  { key: "support", label: "Suporte", icon: "message-square" },
  { key: "ai", label: "Uso de IA", icon: "sparkles" },
];

export interface AdminProduct {
  id: string;
  produto_externo_id?: string | null;
  nome: string;
  categoria?: string | null;
  imagem_url?: string | null;
  preco_texto?: string | null;
  preco_min_brl?: number | null;
  preco_max_brl?: number | null;
  loja_nome?: string | null;
  comissao_percentual?: number | null;
  unidades_vendidas_periodo?: number | null;
  crescimento_vendas_percentual?: number | null;
  unidades_vendidas_total?: number | null;
  receita_periodo_brl?: number | null;
  receita_total_brl?: number | null;
  tiktok_shop_url?: string | null;
  ranking_origem?: number | null;
  fonte_dados?: string | null;
  destaque?: boolean | null;
  ordem_destaque?: number | null;
  status: "ativo" | "pausado";
  [key: string]: unknown;
}

export interface AdminProductPage {
  items: AdminProduct[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminCreator {
  id: string;
  user_id: string;
  nome?: string | null;
  email?: string | null;
  nicho?: string[] | null;
  status: "ativo" | "bloqueado";
  plan?: string | null;
  plan_status?: string | null;
  plan_period?: string | null;
  trial_ends_at?: string | null;
  current_period_end?: string | null;
  /** Calculado no servidor pelo gating: o plano vale agora? */
  plan_active?: boolean;
  /** Fim do acesso (assinatura) ou do trial. */
  plan_until?: string | null;
  criado_em?: string | null;
}

export interface AdminCreatorDetail {
  creator: Record<string, unknown>;
  nome: string | null;
  email: string | null;
  subscriptions: Array<{
    id: string;
    plan: string;
    period: string;
    status: string;
    amount_cents: number | null;
    current_period_end: string | null;
    pending_plan: string | null;
    created_at: string;
  }>;
  usage: Array<{
    usage_date: string;
    assistant_calls: number;
    kit_calls: number;
    support_calls: number;
    total_tokens: number;
  }>;
  sessions: Array<{ id: string; title: string | null; created_at: string; updated_at: string }>;
  tickets: Array<{ id: string; subject: string; status: string; category: string; last_message_at: string }>;
  counts: {
    content_kits: number;
    discovery_sessions: number;
    support_tickets: number;
    creator_content: number;
    shared_conversations: number;
  };
}

export interface AdminBillingSummary {
  active: number;
  trialing: number;
  past_due: number;
  canceled: number;
  pending: number;
  failed: number;
  expiring_7d: number;
  creators_total: number;
  mrr_cents: number;
}

export interface AdminSubscription {
  id: string;
  plan: string;
  plan_label: string;
  period: string;
  status: string;
  provider?: string | null;
  amount_cents: number | null;
  current_period_end: string | null;
  pending_plan_label: string | null;
  created_at: string;
  creator_nome: string | null;
  creator_email: string | null;
}

export interface AdminLead {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  mensagem: string;
  status: "novo" | "contatado" | "qualificado" | "descartado" | string;
  source: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface AdminLeadPage {
  items: AdminLead[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminFunnelEvent {
  event_name: string;
  total: number;
}

export interface AdminAiDayRow {
  usage_date: string;
  classify_calls: number;
  classify_tokens: number;
  classify_cache_hits: number;
  generate_calls: number;
  generate_tokens: number;
  generate_retries: number;
}

export interface AdminAiUsage {
  today: Record<string, number | string> & { store?: string };
  series: AdminAiDayRow[];
  usage: Array<{
    usage_date: string;
    assistant_calls: number;
    kit_calls: number;
    support_calls: number;
    total_tokens: number;
  }>;
  config: {
    provider: string;
    model: string;
    quota_store: string;
    quotas: {
      ASSISTANT_PER_DAY: number;
      KIT_PER_DAY: number;
      SUPPORT_PER_DAY: number;
      FORCE_NEW_COOLDOWN_MS: number;
    };
    billing_enabled: boolean;
  };
}

export interface AdminDashboardMetrics {
  [key: string]: number | string;
}

export interface ProductFormState {
  externalId: string;
  name: string;
  category: string;
  store: string;
  priceText: string;
  commission: string;
  priceMin: string;
  priceMax: string;
  region: string;
  sourceStatus: string;
  salesPeriod: string;
  salesGrowth: string;
  salesTotal: string;
  revenuePeriod: string;
  revenueTotal: string;
  storeSalesTotal: string;
  uploadDate: string;
  ranking: string;
  description: string;
  image: string;
  tiktokUrl: string;
  fastmossUrl: string;
  storeFastmossUrl: string;
  source: string;
  status: "ativo" | "pausado";
  featured: boolean;
  featuredOrder: string;
}

export type ProductSort = "ranking" | "vendas" | "receita" | "nome";
