export interface Product {
  id: string;
  produto_externo_id?: string | null;
  nome: string;
  descricao?: string | null;
  categoria?: string | null;
  imagem_url?: string | null;
  loja_nome?: string | null;
  preco_texto?: string | null;
  preco_min_brl?: number | null;
  preco_max_brl?: number | null;
  comissao_percentual?: number | null;
  unidades_vendidas_periodo?: number | null;
  unidades_vendidas_total?: number | null;
  crescimento_vendas_percentual?: number | null;
  tiktok_shop_url?: string | null;
  fastmoss_produto_url?: string | null;
  atualizado_em?: string | null;
  motivo?: string | null;
}

export interface ContentKit {
  id: string;
  product_id: string;
  titulo: string;
  descricao?: string | null;
  formato?: string | null;
  nivel_dificuldade?: string | null;
  hook?: string | null;
  roteiro?: string | null;
  cenas?: unknown;
  copy?: string | null;
  cta?: string | null;
  hashtags?: string[] | null;
  audio_sugerido?: string | null;
  duracao_seg?: number | null;
  briefing_usuario?: string | null;
  usou_voz?: boolean | null;
}

export interface CreatorContent {
  id: string;
  creator_id: string;
  product_id: string;
  content_kit_id: string | null;
  status: "salvo" | "em_producao" | "gravado" | "publicado";
  notas?: string | null;
  published_url?: string | null;
  atualizado_em?: string | null;
  products?: Product | null;
  content_kits?: ContentKit | null;
}

export interface MeResponse {
  user_id: string;
  creator: {
    id: string;
    objetivo?: string | null;
    estilos_conteudo?: string[];
    temas_interesse?: string[];
    voz_exemplo?: string | null;
    plan?: string | null;
    plan_status?: string | null;
    plan_period?: string | null;
    trial_ends_at?: string | null;
    current_period_end?: string | null;
    cancel_at_period_end?: boolean | null;
  } | null;
  onboarding_completo: boolean;
  is_admin: boolean;
}

export interface BillingLimits {
  searchesPerDay: number | null;
  kitsPerMonth: number | null;
  variations: boolean;
  variationCooldownSeconds: number;
  vozPersonalizada: boolean;
  kitsPerProduct: number | null;
  productionItems: number | null;
}

export interface BillingPlanMeta {
  id: string;
  nome: string;
  resumo: string;
  precoMensalCents: number | null;
  precoAnualCents: number | null;
  precoMensal: string | null;
  precoAnual: string | null;
  precoLancamentoMensalCents?: number | null;
  precoLancamentoAnualCents?: number | null;
  precoLancamentoMensal?: string | null;
  precoLancamentoAnual?: string | null;
  bullets: string[];
  destaque: boolean;
  limits: BillingLimits;
}

export interface BillingLaunchOffer {
  active: boolean;
  seats_total: number;
  seats_left: number;
  monthly_cents: number;
  annual_cents: number;
}

export interface BillingCatalogResponse {
  enabled: boolean;
  trial_days: number;
  free?: { searches_total: number; kits_total: number };
  launch?: BillingLaunchOffer | null;
  plans: BillingPlanMeta[];
}

export interface BillingSubscriptionSummary {
  enabled: boolean;
  plan?: string;
  plan_label?: string;
  status?: string;
  period?: string | null;
  trial_ends_at?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
  has_active_subscription?: boolean;
  payment_mode?: "recurring" | "one_time" | null;
  launch_price?: boolean;
  renewal_due?: boolean;
  pending_plan?: string | null;
  pending_plan_label?: string | null;
  pending_period?: string | null;
  limits?: BillingLimits;
  usage?: {
    kits_total: number;
    kits_month: number;
    kits_limit: number | null;
    kits_limit_period: "month" | "lifetime";
    searches_today: number;
    searches_total?: number | null;
    searches_limit: number | null;
    searches_limit_period?: "day" | "lifetime";
  };
}

export type SupportStatus = "open" | "answered" | "resolved" | "closed";

export interface SupportTicket {
  id: string;
  subject: string;
  category: string;
  status: SupportStatus;
  last_message_at: string;
  created_at: string;
}

export interface SupportMessage {
  id: string;
  author: "creator" | "support";
  body: string;
  created_at: string;
}

export interface SupportTicketThread extends SupportTicket {
  messages: SupportMessage[];
}

export interface AdminSupportTicket extends SupportTicket {
  creator_id: string;
  creator_email: string | null;
  creator_nome: string | null;
}

export interface AdminSupportTicketThread extends AdminSupportTicket {
  messages: SupportMessage[];
}

export interface AssistantResponse {
  message: string;
  products: Product[];
  needs_clarification?: boolean;
}

/** Item resumido do histórico de buscas do Descobrir. */
export interface DiscoverySearchSummary {
  id: string;
  query: string;
  result_count: number;
  needs_clarification: boolean;
  created_at: string;
  updated_at: string;
}

/** Busca completa: reabrir restaura a resposta sem nova chamada de IA. */
export interface DiscoverySearch extends DiscoverySearchSummary {
  message: string;
  results: Product[];
  context_ids: string[];
}
