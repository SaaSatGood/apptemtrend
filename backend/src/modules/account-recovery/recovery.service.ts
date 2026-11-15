import { supabaseAdmin } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';
import { createAppError } from '../../types/index.js';
import { sendVerificationCodeEmail } from '../../lib/email.js';
import {
  assertResendAllowed,
  consumeVerificationCode,
  findUserIdentityByEmail,
  issueVerificationCode,
  normalizeEmail,
  userName,
} from '../signup/verification-codes.js';

const PASSWORD_MIN = 8;

export interface PasswordResetRequestInput {
  email: string;
}

export interface PasswordResetSubmitInput {
  email: string;
  code: string;
  password: string;
}

/**
 * Pede um código de redefinição. A resposta é sempre a mesma:
 * - conta inexistente, não confirmada ou só Google => não envia nada;
 * - conta com senha (criada manualmente) => envia o código.
 * Assim a rota não serve para descobrir quais e-mails têm conta.
 */
export async function requestPasswordReset(
  input: PasswordResetRequestInput,
): Promise<{ ok: true }> {
  const email = normalizeEmail(input.email);
  const identity = await findUserIdentityByEmail(email);

  // Contas Google não têm credencial de senha e nunca recebem código.
  if (!identity || !identity.emailConfirmed || !identity.hasPassword) {
    return { ok: true };
  }

  await assertResendAllowed(email, 'password_reset');
  const nome = await userName(identity.userId);

  await issueVerificationCode({
    email,
    userId: identity.userId,
    nome,
    purpose: 'password_reset',
    sendEmail: (code) =>
      sendVerificationCodeEmail({ to: email, code, nome }, 'password_reset'),
  });

  return { ok: true };
}

/**
 * Valida o código e troca a senha. O código só existe para contas com
 * credencial de e-mail; uma conta Google nunca chega aqui com código válido.
 */
export async function resetPassword(input: PasswordResetSubmitInput): Promise<{ ok: true }> {
  if (input.password.length < PASSWORD_MIN) {
    throw createAppError(
      'WEAK_PASSWORD',
      `A nova senha precisa ter pelo menos ${PASSWORD_MIN} caracteres.`,
      400,
    );
  }

  const email = normalizeEmail(input.email);
  const identity = await findUserIdentityByEmail(email);
  if (!identity || !identity.hasPassword) {
    throw createAppError(
      'PASSWORD_RESET_UNAVAILABLE',
      'Esta conta não usa senha para entrar. Use o login com Google.',
      400,
    );
  }

  const consumed = await consumeVerificationCode({
    email,
    code: input.code,
    purpose: 'password_reset',
  });

  const { error } = await supabaseAdmin.auth.admin.updateUserById(consumed.userId, {
    password: input.password,
  });
  if (error) {
    logger.error({ err: error }, 'Could not update password after code verification');
    throw createAppError(
      'PASSWORD_UPDATE_FAILED',
      'Não conseguimos salvar sua nova senha agora. Tente novamente em instantes.',
      503,
    );
  }

  return { ok: true };
}
