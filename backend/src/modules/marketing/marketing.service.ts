import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { supabaseAdmin } from '../../lib/supabase.js';

const RESEND_EVENTS_URL = 'https://api.resend.com/events/send';
const RESEND_AUDIENCE_FALLBACK = '1bec4a8d-4566-498c-b535-db1996d00010';
const WELCOME_FLAG = 'tt_welcome_sent';
const REQUEST_TIMEOUT_MS = 5000;

export const MARKETING_EVENTS = {
  CONTATO_CRIADO: 'contato.criado',
  ONBOARDING_CONCLUIDO: 'onboarding.concluido',
} as const;

function resendKey(): string | null {
  return env.RESEND_API_KEY?.trim() ? env.RESEND_API_KEY.trim() : null;
}

function audienceId(): string {
  return env.RESEND_AUDIENCE_ID?.trim() ? env.RESEND_AUDIENCE_ID.trim() : RESEND_AUDIENCE_FALLBACK;
}

async function postResend(path: string, body: unknown): Promise<{ ok: boolean; status: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.resend.com${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return { ok: res.status >= 200 && res.status < 300, status: res.status };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Cria ou atualiza o contato na audiência (para FIRST_NAME/LAST_NAME
 * resolverem nos templates). Nunca lança exceção.
 */
export async function upsertMarketingContact(email: string, firstName?: string | null): Promise<boolean> {
  const key = resendKey();
  if (!key || !email) return false;
  try {
    const created = await postResend(`/audiences/${audienceId()}/contacts`, {
      email,
      ...(firstName ? { first_name: firstName } : {}),
      unsubscribed: false,
    });
    if (created.ok) return true;
    const updated = await postResend(`/audiences/${audienceId()}/contacts/${encodeURIComponent(email)}`, {
      ...(firstName ? { first_name: firstName } : {}),
      unsubscribed: false,
    });
    if (!updated.ok) {
      logger.warn({ status: updated.status }, 'Resend contact upsert rejected');
    }
    return updated.ok;
  } catch (err) {
    logger.warn({ err }, 'Resend contact upsert failed');
    return false;
  }
}

/**
 * Dispara um evento de automação no Resend (a automação cria o contato
 * sozinha quando ele não existe). Nunca lança exceção.
 */
export async function trackMarketingEvent(
  event: string,
  params: { email?: string | null; payload?: Record<string, unknown> },
): Promise<boolean> {
  const key = resendKey();
  if (!key || !params.email) return false;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let status = 0;
    try {
      const res = await fetch(RESEND_EVENTS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ event, email: params.email, payload: params.payload ?? {} }),
        signal: controller.signal,
      });
      status = res.status;
    } finally {
      clearTimeout(timeout);
    }
    if (status !== 202) {
      logger.warn({ event, status }, 'Resend event rejected');
      return false;
    }
    logger.info({ event }, 'Marketing event tracked');
    return true;
  } catch (err) {
    logger.warn({ err, event }, 'Marketing event failed');
    return false;
  }
}

function firstNameOf(metadata: Record<string, unknown> | null | undefined): string | null {
  const full = metadata?.full_name ?? metadata?.name;
  if (typeof full !== 'string') return null;
  const first = full.trim().split(/\s+/)[0];
  return first ? first : null;
}

/**
 * Série de boas-vindas, disparada uma única vez por usuário (flag em
 * app_metadata). Best-effort: nunca quebra o fluxo principal.
 */
export async function trackContatoCriadoOnce(userId: string, email?: string | null): Promise<boolean> {
  if (!resendKey() || !email) return false;
  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (error || !data.user) return false;
    const metadata = (data.user.app_metadata ?? {}) as Record<string, unknown>;
    if (metadata[WELCOME_FLAG] === true) return true;
    const nome = firstNameOf((data.user.user_metadata ?? {}) as Record<string, unknown>);
    await upsertMarketingContact(email, nome);
    const tracked = await trackMarketingEvent(MARKETING_EVENTS.CONTATO_CRIADO, {
      email,
      payload: nome ? { nome } : {},
    });
    if (tracked) {
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        app_metadata: { ...metadata, [WELCOME_FLAG]: true },
      }).then(
        () => undefined,
        (flagError: unknown) => logger.warn({ err: flagError }, 'Welcome flag update failed'),
      );
    }
    return tracked;
  } catch (err) {
    logger.warn({ err }, 'Welcome event orchestration failed');
    return false;
  }
}

/**
 * Evento de onboarding concluído. Chamado só na primeira conclusão
 * (o service verifica `alreadyComplete` antes).
 */
export async function trackOnboardingConcluido(
  email?: string | null,
  alreadyComplete = false,
): Promise<boolean> {
  if (alreadyComplete || !email) return true;
  return trackMarketingEvent(MARKETING_EVENTS.ONBOARDING_CONCLUIDO, { email });
}
