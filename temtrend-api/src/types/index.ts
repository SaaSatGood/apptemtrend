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
  VALIDATION: (message: string) =>
    createAppError('VALIDATION_ERROR', message, 422),
  BAD_REQUEST: (message: string) =>
    createAppError('BAD_REQUEST', message, 400),
  INTERNAL: createAppError('INTERNAL_ERROR', 'Erro interno do servidor.', 500),
  RATE_LIMITED: createAppError('RATE_LIMITED', 'Muitas requisições. Tente novamente em breve.', 429),
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
  onboarding_completo?: boolean;
  status: string;
  criado_em: string;
  atualizado_em: string;
}

export interface Product {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  imagem_url: string | null;
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

