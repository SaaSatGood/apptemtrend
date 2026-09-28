export class TikTokError extends Error {
  constructor(public code: string, message: string, public statusCode: number) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class TikTokNotConnectedError extends TikTokError {
  constructor() { super('TIKTOK_NOT_CONNECTED', 'Conecte sua conta TikTok para continuar.', 409); }
}
export class TikTokTokenExpiredError extends TikTokError {
  constructor() { super('TIKTOK_TOKEN_EXPIRED', 'TikTok precisa ser conectado novamente.', 401); }
}
export class TikTokAuthorizationError extends TikTokError {
  constructor(message = 'Não foi possível autorizar sua conta TikTok.') { super('TIKTOK_AUTHORIZATION_ERROR', message, 400); }
}
export class TikTokRateLimitError extends TikTokError {
  constructor() { super('TIKTOK_RATE_LIMITED', 'O TikTok recebeu muitas tentativas. Aguarde um pouco.', 429); }
}
export class TikTokPublishError extends TikTokError {
  constructor(message = 'Não conseguimos publicar seu vídeo no TikTok.') { super('TIKTOK_PUBLISH_ERROR', message, 502); }
}
export class TikTokVideoValidationError extends TikTokError {
  constructor(message = 'Esse vídeo não pode ser publicado no TikTok. Verifique o formato, duração ou tamanho do arquivo.') { super('TIKTOK_VIDEO_INVALID', message, 400); }
}
export class TikTokPrivacyError extends TikTokError {
  constructor() { super('TIKTOK_PRIVACY_INVALID', 'Escolha uma opção de privacidade disponível para sua conta.', 400); }
}
export class TikTokUploadError extends TikTokError {
  constructor() { super('TIKTOK_UPLOAD_ERROR', 'Não conseguimos enviar seu vídeo. Tente novamente.', 502); }
}
export class TikTokProcessingError extends TikTokError {
  constructor() { super('TIKTOK_PROCESSING_ERROR', 'O TikTok não conseguiu processar este vídeo.', 502); }
}
export class TikTokConfigurationError extends TikTokError {
  constructor() { super('TIKTOK_NOT_CONFIGURED', 'A conexão com o TikTok ainda não foi configurada.', 503); }
}

export function mapTikTokError(status: number, code?: string): TikTokError {
  if (status === 401 || code === 'access_token_invalid') return new TikTokTokenExpiredError();
  if (status === 429 || code === 'rate_limit_exceeded') return new TikTokRateLimitError();
  if (code === 'unaudited_client_can_only_post_to_private_accounts') {
    return new TikTokPrivacyError();
  }
  return new TikTokPublishError();
}

