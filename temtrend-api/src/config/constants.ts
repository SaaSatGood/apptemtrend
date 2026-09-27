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
} as const;

export const UPLOAD = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
  BUCKET: 'products',
} as const;
