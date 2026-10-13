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
  ASSISTANT_SEARCH: { max: 10, timeWindow: '1 minute' },
  CONTENT_KIT_GENERATE: { max: 5, timeWindow: '1 minute' },
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
  ADMIN_FLAG: 60 * 1000, // 60s por user_id (revogação rápida)
  ME: 30 * 1000, // 30s perfil /me por user_id (onboarding invalida na hora)
  CATALOG: 5 * 60 * 1000, // 5min catálogo ativo (escritas invalidam na hora)
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
  // 25 itens x ~35 tokens = ~875 tokens de catálogo (antes 100 x ~80 = 8000).
  MAX_CATALOG_ITEMS: 25,
  MAX_DESCRIPTION_CHARS: 60,
  MAX_NAME_CHARS: 50,
  CLASSIFY_TIMEOUT_MS: 8_000,
  CLASSIFY_MAX_OUTPUT_TOKENS: 400,
  CLASSIFY_CACHE_TTL_MS: 30 * 60 * 1000,
  ASSISTANT_RESPONSE_CACHE_TTL_MS: 10 * 60 * 1000,
  // Geração de kit: 1 tentativa inicial + 2 retries (confiabilidade primeiro).
  MAX_GENERATION_ATTEMPTS: 3,
  GENERATE_TIMEOUT_MS: 30_000,
  GENERATE_MAX_OUTPUT_TOKENS: 3000,
  MAX_PREVIOUS_KITS: 3,
  MAX_PREVIOUS_KIT_CHARS: 120,
  MAX_BRIEFING_CHARS: 400,
  MAX_PRODUCT_DESC_CHARS: 500,
} as const;
