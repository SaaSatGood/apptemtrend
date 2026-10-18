export interface AppError {
  code: string;
  message: string;
  statusCode: number;
}

export function createAppError(code: string, message: string, statusCode: number): AppError {
  return { code, message, statusCode };
}

// Common errors
export const Errors = {
  UNAUTHORIZED: createAppError('UNAUTHORIZED', 'Autenticação necessária.', 401),
  FORBIDDEN: createAppError('FORBIDDEN', 'Acesso negado.', 403),
  NOT_FOUND: (resource: string) =>
    createAppError('RESOURCE_NOT_FOUND', `${resource} não encontrado(a).`, 404),
  CONFLICT: (message: string) =>
    createAppError('CONFLICT', message, 409),
  BAD_REQUEST: (message: string) =>
    createAppError('BAD_REQUEST', message, 400),
} as const;

export interface AuthUser {
  id: string;       // auth.users.id
  email?: string;
}

export interface Creator {
  id: string;
  user_id: string;
  nicho: string[];
  plataformas: string[];
  tem_conta_afiliada: boolean;
  objetivo?: string | null;
  estilos_conteudo?: string[];
  temas_interesse?: string[];
  voz_exemplo?: string | null;
  onboarding_completo?: boolean;
  status: string;
  // Billing (migration 028): presentes só quando o billing está ativo.
  plan?: string | null;
  plan_status?: string | null;
  plan_period?: string | null;
  trial_ends_at?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean | null;
  criado_em: string;
  atualizado_em: string;
}

export interface Product {
  id: string;
  produto_externo_id: string | null;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  imagem_url: string | null;
  loja_nome: string | null;
  preco_texto: string | null;
  preco_min_brl: number | null;
  preco_max_brl: number | null;
  pais_regiao: string | null;
  comissao_percentual: number | null;
  unidades_vendidas_periodo: number | null;
  crescimento_vendas_percentual: number | null;
  unidades_vendidas_total: number | null;
  receita_periodo_brl: number | null;
  receita_total_brl: number | null;
  data_estimada_upload: string | null;
  unidades_vendidas_total_loja: number | null;
  fastmoss_produto_url: string | null;
  tiktok_shop_url: string | null;
  fastmoss_loja_url: string | null;
  status_origem: string | null;
  fonte_dados: string | null;
  ranking_origem: number | null;
  status: string;
  destaque: boolean;
  ordem_destaque: number;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface ContentKit {
  id: string;
  product_id: string;
  creator_id: string | null;
  briefing_usuario: string | null;
  usou_voz?: boolean | null;
  titulo: string;
  descricao: string | null;
  formato: string | null;
  plataforma: string | null;
  nivel_dificuldade: string | null;
  hook: string | null;
  roteiro: string | null;
  cenas: unknown | null;
  copy: string | null;
  cta: string | null;
  hashtags: string[] | null;
  audio_sugerido: string | null;
  duracao_seg: number | null;
  criado_em: string;
  atualizado_em: string;
}

export interface CreatorContent {
  id: string;
  creator_id: string;
  product_id: string;
  content_kit_id: string | null;
  status: string;
  notas: string | null;
  published_url: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface Admin {
  id: string;
  user_id: string;
  nivel: string | null;
}

