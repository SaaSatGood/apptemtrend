import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';

// Cliente Asaas v3 (cartão recorrente). PIX continua no AbacatePay.
const TIMEOUT_MS = 15_000;

export function isAsaasConfigured(): boolean {
  return Boolean(env.ASAAS_API_KEY);
}

function baseUrl(): string {
  return env.ASAAS_API_URL.replace(/\/$/, '');
}

function todayInSaoPaulo(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

interface AsaasRequestResult<T> {
  data: T | null;
  error: string | null;
  status: number | null;
}

function errorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  const errors = record.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    const first = errors[0] as Record<string, unknown>;
    const description = typeof first.description === 'string' ? first.description : null;
    if (description) return description;
  }
  const message = record.message;
  return typeof message === 'string' ? message : null;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<AsaasRequestResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl()}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        access_token: env.ASAAS_API_KEY ?? '',
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      const detail = errorMessage(payload) ?? `status_${response.status}`;
      logger.error({ path, status: response.status, detail }, 'Asaas request rejected');
      return { data: null, error: detail, status: response.status };
    }
    return { data: payload as T, error: null, status: response.status };
  } catch (error) {
    logger.error({ err: error, path }, 'Asaas request failed');
    return { data: null, error: 'network', status: null };
  } finally {
    clearTimeout(timer);
  }
}

export interface AsaasCheckoutInput {
  externalReference: string;
  amountCents: number;
  period: 'monthly' | 'annual';
  successUrl: string;
  cancelUrl: string;
  expiredUrl: string;
}

export interface AsaasCheckout {
  id: string;
  url: string;
}

/**
 * Cria um Checkout hospedado no Asaas com cartão de crédito recorrente.
 * O cartão é digitado na página do Asaas; nunca passa pela nossa API.
 */
export async function createAsaasCardCheckout(input: AsaasCheckoutInput): Promise<AsaasCheckout | null> {
  if (!isAsaasConfigured()) {
    logger.error('Asaas checkout requested without ASAAS_API_KEY');
    return null;
  }
  const cycle = input.period === 'annual' ? 'YEARLY' : 'MONTHLY';
  const result = await request<{ id?: string; link?: string }>('/v3/checkouts', {
    method: 'POST',
    body: JSON.stringify({
      billingTypes: ['CREDIT_CARD'],
      chargeTypes: ['RECURRENT'],
      minutesToExpire: 60,
      externalReference: input.externalReference,
      callback: {
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
        expiredUrl: input.expiredUrl,
      },
      items: [{
        name: 'TemTrend Pro',
        description: input.period === 'annual' ? 'Assinatura anual' : 'Assinatura mensal',
        quantity: 1,
        value: input.amountCents / 100,
      }],
      subscription: {
        cycle,
        nextDueDate: todayInSaoPaulo(),
      },
    }),
  });
  if (!result.data?.id) {
    logger.error({ error: result.error }, 'Asaas checkout without id');
    return null;
  }
  const url = result.data.link
    ?? `${baseUrl().includes('sandbox') ? 'https://sandbox.asaas.com' : 'https://asaas.com'}/checkoutSession/show?id=${result.data.id}`;
  return { id: result.data.id, url };
}

export interface AsaasSubscriptionInfo {
  id: string;
  customer?: string;
  externalReference?: string | null;
  status?: string;
}

/** Busca a assinatura ativa mais recente do cliente (usada no CHECKOUT_PAID). */
export async function findAsaasActiveSubscription(
  customerId: string,
  externalReference?: string | null,
): Promise<AsaasSubscriptionInfo | null> {
  const result = await request<{ data?: AsaasSubscriptionInfo[] }>(
    `/v3/subscriptions?customer=${encodeURIComponent(customerId)}&status=ACTIVE&limit=10`,
  );
  const items = Array.isArray(result.data?.data) ? result.data.data : [];
  if (items.length === 0) return null;
  if (externalReference) {
    const match = items.find((item) => item.externalReference === externalReference);
    if (match) return match;
  }
  return items[0] ?? null;
}

/** Cancela a assinatura no Asaas. 404 significa que ela já não existe. */
export async function cancelAsaasSubscription(subscriptionId: string): Promise<boolean> {
  const result = await request<unknown>(`/v3/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: 'DELETE',
  });
  if (result.status === 404) return true;
  return result.data != null && result.error == null;
}
