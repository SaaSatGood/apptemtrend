import { supabaseAdmin } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';
import { createAppError } from '../../types/index.js';
import { sendVerificationCodeEmail } from '../../lib/email.js';
import {
  CODE_TTL_SECONDS,
  assertResendAllowed,
  consumeVerificationCode,
  findUserIdentityByEmail,
  hashVerificationCode,
  issueVerificationCode,
  normalizeEmail,
  userName,
} from './verification-codes.js';

export { CODE_TTL_SECONDS, hashVerificationCode } from './verification-codes.js';

export interface SignupInput {
  nome: string;
  email: string;
  password: string;
}

export interface VerifyInput {
  email: string;
  code: string;
}

/**
 * Cria a conta já sem sessão (e-mail ainda não confirmado) e envia o código.
 * O GoTrue não dispara e-mail próprio via Admin API, então o único e-mail
 * que o usuário recebe é o nosso código.
 */
export async function signup(input: SignupInput): Promise<{ email: string }> {
  const email = normalizeEmail(input.email);
  await assertResendAllowed(email, 'signup');

  let userId: string;
  try {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: false,
      user_metadata: { full_name: input.nome, name: input.nome },
    });

    if (error) {
      if (/already.*registered|already been registered|email_exists|duplicate/i.test(error.message)) {
        throw createAppError(
          'EMAIL_IN_USE',
          'Este e-mail já tem uma conta. Entre com sua senha ou recupere o acesso.',
          409,
        );
      }
      logger.error({ err: error }, 'Supabase signup failed');
      throw createAppError(
        'SIGNUP_FAILED',
        'Não conseguimos criar sua conta agora. Tente novamente em instantes.',
        503,
      );
    }
    if (!data.user?.id) {
      throw createAppError(
        'SIGNUP_FAILED',
        'Não conseguimos criar sua conta agora. Tente novamente em instantes.',
        503,
      );
    }
    userId = data.user.id;
  } catch (err) {
    if ((err as { statusCode?: number })?.statusCode) throw err;
    logger.error({ err }, 'Supabase signup request failed');
    throw createAppError(
      'SIGNUP_FAILED',
      'Não conseguimos criar sua conta agora. Tente novamente em instantes.',
      503,
    );
  }

  try {
    await issueVerificationCode({
      email,
      userId,
      nome: input.nome,
      purpose: 'signup',
      sendEmail: (code) => sendVerificationCodeEmail({ to: email, code, nome: input.nome }),
    });
  } catch (err) {
    // Sem código o usuário não consegue entrar: desfaz o cadastro para que
    // ele possa tentar de novo com o mesmo e-mail.
    await supabaseAdmin.auth.admin.deleteUser(userId).then(
      () => undefined,
      (deleteError: unknown) => logger.warn({ err: deleteError }, 'Signup rollback failed'),
    );
    throw err;
  }

  return { email };
}

export async function verifyCode(input: VerifyInput): Promise<{ email: string }> {
  const consumed = await consumeVerificationCode({
    email: input.email,
    code: input.code,
    purpose: 'signup',
  });

  const { error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(consumed.userId, {
    email_confirm: true,
  });
  if (confirmError) {
    logger.error({ err: confirmError }, 'Could not confirm user email');
    throw createAppError(
      'EMAIL_CONFIRM_FAILED',
      'Código correto, mas não conseguimos liberar sua conta agora. Tente novamente em instantes.',
      503,
    );
  }

  return { email: consumed.email };
}

/**
 * Reenvia o código para uma conta ainda não confirmada. Resposta sempre
 * genérica para não revelar se o e-mail existe na base.
 */
export async function resendCode(emailInput: string): Promise<{ sent: boolean }> {
  const email = normalizeEmail(emailInput);
  const identity = await findUserIdentityByEmail(email);
  if (!identity || identity.emailConfirmed || !identity.hasPassword) {
    return { sent: false };
  }

  await assertResendAllowed(email, 'signup');
  const nome = await userName(identity.userId);
  await issueVerificationCode({
    email,
    userId: identity.userId,
    nome,
    purpose: 'signup',
    sendEmail: (code) => sendVerificationCodeEmail({ to: email, code, nome }),
  });
  return { sent: true };
}
