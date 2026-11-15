import crypto from 'node:crypto';
import { supabaseAdmin } from '../../lib/supabase.js';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { createAppError } from '../../types/index.js';

export const CODE_TTL_SECONDS = 10 * 60;
export const RESEND_INTERVAL_SECONDS = 60;
export const MAX_ATTEMPTS = 5;
export const CODE_LENGTH = 6;

export type VerificationPurpose = 'signup' | 'password_reset';

export interface VerificationCodeRow {
  id: string;
  user_id: string | null;
  email: string;
  code_hash: string;
  attempts: number;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
}

export interface UserIdentity {
  userId: string;
  emailConfirmed: boolean;
  hasPassword: boolean;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function codePepper(): string {
  return env.SUPABASE_SERVICE_ROLE_KEY;
}

/**
 * HMAC com pepper do servidor: mesmo com vazamento da tabela, os 6 dígitos
 * não podem ser recuperados por força bruta offline.
 */
export function hashVerificationCode(email: string, code: string): string {
  return crypto
    .createHmac('sha256', codePepper())
    .update(`${normalizeEmail(email)}:${code}`)
    .digest('hex');
}

export function generateVerificationCode(): string {
  return crypto.randomInt(0, 10 ** CODE_LENGTH).toString().padStart(CODE_LENGTH, '0');
}

function safeEqualHex(left: string, right: string): boolean {
  try {
    const a = Buffer.from(left, 'hex');
    const b = Buffer.from(right, 'hex');
    if (a.length === 0 || a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

async function latestActiveCode(
  email: string,
  purpose: VerificationPurpose,
): Promise<VerificationCodeRow | null> {
  const { data, error } = await supabaseAdmin
    .from('email_verification_codes')
    .select('id, user_id, email, code_hash, attempts, expires_at, consumed_at, created_at')
    .eq('email', email)
    .eq('purpose', purpose)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.error({ err: error }, 'Verification code lookup failed');
    throw createAppError(
      'CODE_LOOKUP_FAILED',
      'Não conseguimos validar o código agora. Tente novamente em instantes.',
      503,
    );
  }
  return (data as VerificationCodeRow | null) ?? null;
}

export async function assertResendAllowed(
  email: string,
  purpose: VerificationPurpose,
): Promise<void> {
  const unless = new Date(Date.now() - RESEND_INTERVAL_SECONDS * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from('email_verification_codes')
    .select('id')
    .eq('email', email)
    .eq('purpose', purpose)
    .gte('created_at', unless)
    .limit(1);

  if (error) {
    logger.warn({ err: error }, 'Verification code throttle check failed');
    return; // falha aberta: não trava o fluxo por um problema de leitura
  }
  if (data && data.length > 0) {
    throw createAppError(
      'CODE_RATE_LIMITED',
      'Enviamos um código há pouco. Aguarde 1 minuto para pedir outro.',
      429,
    );
  }
}

export async function issueVerificationCode(input: {
  email: string;
  userId: string;
  purpose: VerificationPurpose;
  nome?: string | null;
  /** Envia o código; retorna false para desfazer o registro. */
  sendEmail?: (code: string) => Promise<boolean>;
}): Promise<void> {
  const email = normalizeEmail(input.email);
  const code = generateVerificationCode();

  // Um código válido por vez: invalida os anteriores do mesmo e-mail/assunto.
  const { error: invalidateError } = await supabaseAdmin
    .from('email_verification_codes')
    .update({ consumed_at: new Date().toISOString() })
    .eq('email', email)
    .eq('purpose', input.purpose)
    .is('consumed_at', null);
  if (invalidateError) {
    logger.warn({ err: invalidateError }, 'Could not invalidate previous verification codes');
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('email_verification_codes')
    .insert({
      user_id: input.userId,
      email,
      purpose: input.purpose,
      code_hash: hashVerificationCode(email, code),
      expires_at: new Date(Date.now() + CODE_TTL_SECONDS * 1000).toISOString(),
    })
    .select('id')
    .maybeSingle();

  if (insertError || !inserted?.id) {
    logger.error({ err: insertError }, 'Could not store verification code');
    throw createAppError(
      'CODE_STORE_FAILED',
      'Não conseguimos gerar seu código agora. Tente novamente em instantes.',
      503,
    );
  }

  const sent = input.sendEmail ? await input.sendEmail(code) : true;

  if (!sent) {
    await supabaseAdmin
      .from('email_verification_codes')
      .delete()
      .eq('id', inserted.id)
      .then(
        () => undefined,
        (err: unknown) => logger.warn({ err }, 'Could not rollback verification code'),
      );
    throw createAppError(
      'EMAIL_SEND_FAILED',
      'Não conseguimos enviar o e-mail de confirmação. Tente novamente em instantes.',
      503,
    );
  }
}

export interface ConsumedCode {
  userId: string;
  email: string;
}

/**
 * Valida e consome um código. Lança AppError com mensagem pronta para o
 * usuário em qualquer falha (expirado, incorreto, tentativas esgotadas).
 */
export async function consumeVerificationCode(input: {
  email: string;
  code: string;
  purpose: VerificationPurpose;
}): Promise<ConsumedCode> {
  const email = normalizeEmail(input.email);
  const row = await latestActiveCode(email, input.purpose);

  if (!row) {
    throw createAppError(
      'CODE_NOT_FOUND',
      'Código expirado ou já utilizado. Peça um novo código.',
      400,
    );
  }

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await supabaseAdmin
      .from('email_verification_codes')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', row.id)
      .then(
        () => undefined,
        (err: unknown) => logger.warn({ err }, 'Could not consume expired code'),
      );
    throw createAppError('CODE_EXPIRED', 'O código expirou. Peça um novo código.', 400);
  }

  if (row.attempts >= MAX_ATTEMPTS) {
    await supabaseAdmin
      .from('email_verification_codes')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', row.id)
      .then(
        () => undefined,
        (err: unknown) => logger.warn({ err }, 'Could not consume blocked code'),
      );
    throw createAppError(
      'CODE_ATTEMPTS_EXCEEDED',
      'Muitas tentativas com este código. Peça um novo código.',
      429,
    );
  }

  if (!safeEqualHex(hashVerificationCode(email, input.code), row.code_hash)) {
    const attempts = row.attempts + 1;
    await supabaseAdmin
      .from('email_verification_codes')
      .update({ attempts })
      .eq('id', row.id)
      .then(
        () => undefined,
        (err: unknown) => logger.warn({ err }, 'Could not record failed verification attempt'),
      );
    const remaining = Math.max(0, MAX_ATTEMPTS - attempts);
    throw createAppError(
      'CODE_INVALID',
      remaining > 0
        ? `Código incorreto. Você ainda tem ${remaining} ${remaining === 1 ? 'tentativa' : 'tentativas'}.`
        : 'Código incorreto. Peça um novo código.',
      400,
    );
  }

  const { error: consumeError } = await supabaseAdmin
    .from('email_verification_codes')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', row.id);
  if (consumeError) {
    logger.warn({ err: consumeError }, 'Could not mark verification code as consumed');
  }

  let userId = row.user_id;
  if (!userId) {
    userId = await findUserIdByEmail(email);
  }
  if (!userId) {
    throw createAppError(
      'ACCOUNT_NOT_FOUND',
      'Não encontramos sua conta. Crie o cadastro novamente.',
      404,
    );
  }

  return { userId, email };
}

export async function findUserIdByEmail(email: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.rpc('auth_user_id_by_email', {
    p_email: normalizeEmail(email),
  });
  if (error) {
    logger.warn({ err: error }, 'Could not resolve user id by email');
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  return row?.user_id ? String(row.user_id) : null;
}

/**
 * Identidade completa: distingue conta com senha (criada manualmente) de
 * conta só Google. Usado para o reset de senha funcionar apenas nas contas
 * com credencial de e-mail.
 */
export async function findUserIdentityByEmail(email: string): Promise<UserIdentity | null> {
  const { data, error } = await supabaseAdmin.rpc('auth_user_identity_by_email', {
    p_email: normalizeEmail(email),
  });
  if (error) {
    logger.error({ err: error }, 'Could not resolve user identity by email');
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.user_id) return null;
  return {
    userId: String(row.user_id),
    emailConfirmed: row.email_confirmed === true,
    hasPassword: row.has_password === true,
  };
}

export async function userName(userId: string): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
    const metadata = (data?.user?.user_metadata ?? {}) as Record<string, unknown>;
    const fullName = metadata.full_name ?? metadata.name;
    return typeof fullName === 'string' ? fullName : null;
  } catch (err) {
    logger.warn({ err }, 'Could not load user name');
    return null;
  }
}
