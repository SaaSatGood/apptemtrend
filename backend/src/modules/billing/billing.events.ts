// Parsing puro de webhooks v2 da AbacatePay: { id, event, apiVersion, data }.
// Sem I/O — testável e tolerante a mudanças de shape.

export interface ParsedBillingEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

export function parseWebhookEvent(body: unknown): ParsedBillingEvent | null {
  const record = asRecord(body);
  if (!record) return null;
  const id = asString(record.id);
  const type = asString(record.event);
  if (!id || !type) return null;
  return { id, type, data: asRecord(record.data) ?? {} };
}

export interface SubscriptionSnapshot {
  subscriptionId: string | null;
  checkoutId: string | null;
  status: string | null;
  trialEndsAt: string | null;
}

export function extractSubscription(data: Record<string, unknown>): SubscriptionSnapshot {
  const subscription = asRecord(data.subscription) ?? data;
  return {
    subscriptionId: asString(subscription.id),
    checkoutId: asString(subscription.checkoutId) ?? asString(data.checkoutId),
    status: asString(subscription.status),
    trialEndsAt: asString(subscription.trialEndsAt),
  };
}

export interface CheckoutSnapshot {
  checkoutId: string | null;
  externalId: string | null;
  metadataCreatorId: string | null;
  productId: string | null;
}

export function extractCheckout(data: Record<string, unknown>): CheckoutSnapshot {
  const checkout = asRecord(data.checkout) ?? data;
  const items = Array.isArray(checkout.items) ? checkout.items : [];
  const firstItem = asRecord(items[0]);
  return {
    checkoutId: asString(checkout.id),
    externalId: asString(checkout.externalId) ?? asString(data.externalId),
    metadataCreatorId:
      asString(asRecord(checkout.metadata)?.creator_id) ?? asString(asRecord(data.metadata)?.creator_id),
    productId: asString(firstItem?.id),
  };
}

/** Estende o fim do período a partir de `fromIso` (ou agora, se passado/ausente). */
export function extendPeriodEnd(fromIso: string | null | undefined, period: string, now: Date = new Date()): string {
  const parsed = fromIso ? Date.parse(fromIso) : NaN;
  const base = Number.isFinite(parsed) && parsed > now.getTime() ? new Date(parsed) : new Date(now.getTime());
  if (period === 'annual') base.setFullYear(base.getFullYear() + 1);
  else base.setMonth(base.getMonth() + 1);
  return base.toISOString();
}
