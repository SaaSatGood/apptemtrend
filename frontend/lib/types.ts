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
  } | null;
  onboarding_completo: boolean;
  is_admin: boolean;
}

export interface AssistantResponse {
  message: string;
  products: Product[];
}
