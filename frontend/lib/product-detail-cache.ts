import { api } from "./api";
import type { ContentKit, Product } from "./types";

export interface ProductDetail {
  product: Product;
  content_kits: ContentKit[];
}

const TTL_MS = 60_000;
const MAX_ENTRIES = 24;

const entries = new Map<string, { data: ProductDetail; at: number; partial?: boolean }>();
const pending = new Map<string, Promise<ProductDetail>>();
const revisions = new Map<string, number>();

function bumpRevision(productId: string) {
  revisions.set(productId, (revisions.get(productId) ?? 0) + 1);
}

function trimEntries() {
  while (entries.size > MAX_ENTRIES) {
    const oldest = entries.keys().next().value;
    if (oldest == null) break;
    entries.delete(oldest);
  }
}

function remember(productId: string, data: ProductDetail, partial = false) {
  entries.delete(productId);
  entries.set(productId, { data, at: Date.now(), partial });
  trimEntries();
}

/** Dados já vistos nesta sessão: a página abre preenchida e revalida depois. */
export function peekProductDetail(productId: string): ProductDetail | null {
  return entries.get(productId)?.data ?? null;
}

/**
 * Busca o produto com single-flight e cache curto. Navegar produto → roteiro
 * (ou voltar) não repete a mesma requisição nem mostra skeleton de novo.
 */
export async function loadProductDetail(
  productId: string,
  accessToken: string | undefined,
  options: { force?: boolean } = {}
): Promise<ProductDetail> {
  const entry = entries.get(productId);
  if (!options.force && entry && !entry.partial && Date.now() - entry.at < TTL_MS) {
    return entry.data;
  }

  if (!options.force) {
    const inFlight = pending.get(productId);
    if (inFlight) return inFlight;
  }

  const revision = revisions.get(productId) ?? 0;
  const request = api<ProductDetail>(`/products/${productId}`, accessToken)
    .then((data) => {
      if ((revisions.get(productId) ?? 0) === revision) remember(productId, data);
      return data;
    });
  pending.set(productId, request);
  return request.finally(() => {
    if (pending.get(productId) === request) pending.delete(productId);
  });
}

/** Um roteiro recém-gerado entra no cache antes da navegação para a página dele. */
export function upsertProductKit(productId: string, kit: ContentKit) {
  const entry = entries.get(productId);
  if (!entry) return;
  bumpRevision(productId);
  const kits = entry.data.content_kits.slice();
  const index = kits.findIndex((item) => item.id === kit.id);
  if (index >= 0) kits[index] = kit;
  else kits.push(kit);
  entries.set(productId, {
    data: { ...entry.data, content_kits: kits },
    at: entry.at,
    partial: entry.partial,
  });
}

/**
 * Aproveita o produto/roteiro que já veio na lista de produção. A entrada é
 * marcada como parcial: a página abre preenchida e revalida em segundo plano.
 */
export function primeProductDetail(product: Product, kit: ContentKit) {
  bumpRevision(product.id);
  const entry = entries.get(product.id);
  const kits = entry?.data.content_kits ? entry.data.content_kits.slice() : [];
  const index = kits.findIndex((item) => item.id === kit.id);
  if (index >= 0) kits[index] = kit;
  else kits.push(kit);
  entries.set(product.id, {
    data: { product, content_kits: kits },
    at: entry?.at ?? Date.now(),
    partial: entry?.partial ?? true,
  });
  trimEntries();
}
