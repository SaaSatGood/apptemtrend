import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';

// Cliente HTTP da AbacatePay v2. Envelope: { data, error, success }.
// Toda chamada é defensiva: billing nunca derruba o app; retorna null e loga.

const TIMEOUT_MS = 12_000;

export function isProviderConfigured(): boolean {
  return Boolean(env.ABACATEPAY_API_KEY);
}

interface RequestResult<T> {
  data: T | null;
  error: string | null;
}

async function request<T>(path: string, body: Record<string, unknown>): Promise<RequestResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${env.ABACATEPAY_API_URL}${path}`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${env.ABACATEPAY_API_KEY ?? ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => null)) as
      | { data?: T; error?: unknown; success?: boolean }
      | null;
    if (!response.ok || !payload || payload.success !== true || payload.data == null) {
      logger.error({ path, status: response.status, payload }, 'AbacatePay request rejected');
      return { data: null, error: `status_${response.status}` };
    }
    return { data: payload.data, error: null };
  } catch (error) {
    logger.error({ err: error, path }, 'AbacatePay request failed');
    return { data: null, error: 'network' };
  } finally {
    clearTimeout(timer);
  }
}

export interface ProviderCheckout {
  id: string;
  url: string;
}

function parseCheckout(data: unknown): ProviderCheckout | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id : null;
  const url = typeof record.url === 'string' ? record.url : null;
  if (!id || !url) {
    logger.error({ data }, 'AbacatePay checkout without id/url');
    return null;
  }
  return { id, url };
}

export async function createSubscriptionCheckout(input: {
  productId: string;
  externalId: string;
  returnUrl: string;
  completionUrl: string;
}): Promise<ProviderCheckout | null> {
  const { data } = await request<unknown>('/subscriptions/create', {
    items: [{ id: input.productId, quantity: 1 }],
    methods: ['PIX', 'CARD'],
    externalId: input.externalId,
    returnUrl: input.returnUrl,
    completionUrl: input.completionUrl,
    metadata: { creator_id: input.externalId, source: 'temtrend' },
  });
  return parseCheckout(data);
}

export async function cancelSubscriptionAtProvider(subscriptionId: string): Promise<boolean> {
  const { data, error } = await request<unknown>('/subscriptions/cancel', { id: subscriptionId });
  return data != null && error == null;
}

/** Agenda a troca de produto (plano) para o próximo ciclo — sem pró-rata. */
export async function changeSubscriptionPlanAtProvider(
  subscriptionId: string,
  productId: string,
): Promise<boolean> {
  const { data, error } = await request<unknown>('/subscriptions/change-plan', {
    id: subscriptionId,
    productId,
    quantity: 1,
  });
  return data != null && error == null;
}
