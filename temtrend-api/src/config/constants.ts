export const CREATOR_STATUS = {
  ATIVO: 'ativo',
  BLOQUEADO: 'bloqueado',
} as const;

export const PRODUCT_STATUS = {
  ATIVO: 'ativo',
  PAUSADO: 'pausado',
} as const;

export const CONTENT_STATUS = {
  SALVO: 'salvo',
  EM_PRODUCAO: 'em_producao',
  GRAVADO: 'gravado',
  PUBLICADO: 'publicado',
} as const;

export const RATE_LIMITS = {
  AUTH_GET: { max: 100, timeWindow: '1 minute' },
  AUTH_WRITE: { max: 30, timeWindow: '1 minute' },
  ADMIN: { max: 60, timeWindow: '1 minute' },
  // Rotas caras de IA: limites próprios para proteger custo/latência.
  ASSISTANT_SEARCH: { max: 20, timeWindow: '1 minute' },
  CONTENT_KIT_GENERATE: { max: 10, timeWindow: '1 minute' },
  GLOBAL: { max: 200, timeWindow: '1 minute' },
} as const;

export const UPLOAD = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
  BUCKET: 'products',
} as const;

export const CACHE_TTL_MS = {
  AUTH_USER: 90 * 1000, // 90s por token
  ADMIN_FLAG: 5 * 60 * 1000, // 5min por user_id
  CATALOG: 60 * 1000, // 60s catálogo ativo
  DASHBOARD: 30 * 1000, // 30s métricas admin
  USER_DIRECTORY: 10 * 60 * 1000, // 10min diretório auth
} as const;

export const PAGINATION = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 50,
  ADMIN_DEFAULT_LIMIT: 50,
  ADMIN_MAX_LIMIT: 100,
} as const;

export const AI_LIMITS = {
  // Classificação: catálogo enxuto enviado ao Gemini (custo/latência).
  MAX_CATALOG_ITEMS: 100,
  MAX_DESCRIPTION_CHARS: 120,
  CLASSIFY_TIMEOUT_MS: 8_000,
  // Geração de kit: 1 tentativa inicial + 1 retry.
  MAX_GENERATION_ATTEMPTS: 2,
  GENERATE_TIMEOUT_MS: 20_000,
} as const;
