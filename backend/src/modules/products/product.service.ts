import { findProductByExternalId, findProductById, listActiveProducts, listActiveProductCategories, searchActiveProducts, createProduct as createProductRepo, updateProduct as updateProductRepo, type ProductSort } from './product.repository.js';
import { listContentKitsByProductId, createContentKit, findContentKitById, deleteContentKit as removeContentKit } from '../content-kits/content-kit.repository.js';
import { createContentKitSchema } from '../content-kits/content-kit.schema.js';
import { AIService } from '../assistant/ai.service.js';
import { buildFallbackKit } from '../assistant/gemini-generation.service.js';
import { env } from '../../config/env.js';
import { TtlCache } from '../../lib/cache.js';
import { Errors, createAppError } from '../../types/index.js';
import { CACHE_TTL_MS, PRODUCT_STATUS } from '../../config/constants.js';
import type { CreateProductInput, UpdateProductInput } from './product.schema.js';
import type { Product } from '../../types/index.js';
import crypto from 'node:crypto';
import { invalidateDashboardCache } from '../admin/admin.repository.js';

const catalogCache = new TtlCache<Product[]>(50);
const categoriesCache = new TtlCache<Array<{ categoria: string; total: number }>>(1);
// Namespaces distintos: catálogo pesquisável (sem filtro) nunca colide com
// catálogo filtrado (categoria/destaque). Datasets diferentes, mesma instância.
const SEARCHABLE_CATALOG_KEY = 'searchable:all';
const FILTERED_CATALOG_PREFIX = 'filtered';

function catalogCacheKey(filters?: { categoria?: string; destaque?: boolean }) {
  return `${FILTERED_CATALOG_PREFIX}:${filters?.categoria ?? '-'}:${filters?.destaque ?? '-'}`;
}

export async function getProducts(
  filters?: { categoria?: string; destaque?: boolean; limit?: number; offset?: number },
) {
  // Compat: chamada sem filtros repassa `undefined` (coberta por teste).
  if (!filters) {
    const products = await listActiveProducts(undefined);
    return products.filter((product) => product.status === PRODUCT_STATUS.ATIVO);
  }
  // Lista paginada não usa cache (varia por página); catálogo cheio do assistant usa.
  if (filters.limit !== undefined || filters.offset !== undefined) {
    const products = await listActiveProducts(filters);
    return products.filter((product) => product.status === PRODUCT_STATUS.ATIVO);
  }
  const key = catalogCacheKey(filters);
  const cached = catalogCache.get(key);
  if (cached) return cached;
  const products = (await listActiveProducts({ ...filters, onlySearchable: false })).filter(
    (product) => product.status === PRODUCT_STATUS.ATIVO,
  );
  catalogCache.set(key, products, CACHE_TTL_MS.CATALOG);
  return products;
}

export function invalidateCatalogCache() {
  catalogCache.clear();
  categoriesCache.clear();
}

export function clearCatalogCacheForTests() {
  catalogCache.clear();
  categoriesCache.clear();
}

export async function listSearchableCatalog(): Promise<Product[]> {
  // Em teste o mock de listActiveProducts muda por caso; não usar cache.
  if (process.env.NODE_ENV === 'test') {
    return listActiveProducts({ onlySearchable: true });
  }
  const cached = catalogCache.get(SEARCHABLE_CATALOG_KEY);
  if (cached) return cached;
  const products = await listActiveProducts({ onlySearchable: true });
  catalogCache.set(SEARCHABLE_CATALOG_KEY, products, CACHE_TTL_MS.CATALOG);
  return products;
}

const CATEGORIES_CACHE_KEY = 'catalog:categories';

export interface CatalogSearchFilters {
  q?: string;
  categoria?: string;
  sort: ProductSort;
  precoMax?: number;
  comissaoMin?: number;
  limit: number;
  offset: number;
}

/** Vitrine do catálogo: busca, filtros e paginação para a tela Produtos. */
export async function searchCatalog(filters: CatalogSearchFilters) {
  const { items, total } = await searchActiveProducts({
    q: filters.q,
    categoria: filters.categoria,
    sort: filters.sort,
    precoMax: filters.precoMax,
    comissaoMin: filters.comissaoMin,
    limit: filters.limit,
    offset: filters.offset,
  });
  return {
    items: items.filter((product) => product.status === PRODUCT_STATUS.ATIVO),
    total,
  };
}

/** Categorias ativas com contagem; cache curto, equal ao do catálogo. */
export async function listCatalogCategories() {
  if (process.env.NODE_ENV === 'test') return listActiveProductCategories();
  const cached = categoriesCache.get(CATEGORIES_CACHE_KEY);
  if (cached) return cached;
  const categorias = await listActiveProductCategories();
  categoriesCache.set(CATEGORIES_CACHE_KEY, categorias, CACHE_TTL_MS.CATALOG);
  return categorias;
}

export async function getProductById(
  id: string,
  options: { includePaused?: boolean; creatorId?: string } = {},
) {
  const product = await findProductById(id);

  if (!product || (!options.includePaused && product.status === PRODUCT_STATUS.PAUSADO)) {
    throw Errors.NOT_FOUND('Produto');
  }

  const contentKits = await listContentKitsByProductId(id, options.creatorId);

  return { product, content_kits: contentKits };
}

export async function createProduct(data: CreateProductInput, adminUserId: string) {
  if (data.produto_externo_id && await findProductByExternalId(data.produto_externo_id)) {
    throw Errors.CONFLICT('Já existe um produto com este ID. Edite o cadastro existente.');
  }
  const created = await createProductRepo({
    ...data,
    criado_por: adminUserId,
  });
  invalidateCatalogCache();
  invalidateDashboardCache();
  return created;
}

export async function updateProductById(id: string, data: UpdateProductInput) {
  const existing = await findProductById(id);

  if (!existing) {
    throw Errors.NOT_FOUND('Produto');
  }

  if (data.produto_externo_id) {
    const duplicate = await findProductByExternalId(data.produto_externo_id);
    if (duplicate && duplicate.id !== id) {
      throw Errors.CONFLICT('Já existe um produto com este ID. Edite o cadastro existente.');
    }
  }

  const updated = await updateProductRepo(id, data);
  invalidateCatalogCache();
  invalidateDashboardCache();
  return updated;
}

const contentKitCreationInFlight = new Map<string, ReturnType<typeof createContentKitResult>>();

function briefingHash(briefing?: string): string {
  const normalized = (briefing ?? '').trim().toLowerCase().slice(0, 1500);
  if (!normalized) return 'empty';
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

function inflightKey(productId: string, creatorId: string, briefing?: string, preferencesBriefing?: string) {
  return `${creatorId}:${productId}:${briefingHash([preferencesBriefing, briefing].filter(Boolean).join(' '))}`;
}

async function createContentKitResult(productId: string, creatorId: string, briefing?: string, voz?: string | null, userId?: string, preferencesBriefing?: string) {
  const { product, content_kits } = await getProductById(productId, { creatorId });
  const temVoz = Boolean(voz?.trim());
  // O briefing escrito pelo usuário prevalece; as preferências entram como
  // contexto de estilo/foco, nunca como dado do produto.
  const aiBriefing = [preferencesBriefing, briefing].filter(Boolean).join(' ') || undefined;
  // Roteiro base garantido: se a IA estiver fora, salva um kit honesto com os
  // dados reais do produto em vez de falhar. `fallback: true` avisa o frontend.
  if (!AIService.isAvailable() && env.NODE_ENV !== 'test') {
    const fallback = buildFallbackKit(product);
    const input = createContentKitSchema.parse(fallback);
    const contentKit = await createContentKit(product.id, input, { creatorId, briefing, usouVoz: false });
    return { content_kit: contentKit, created: true, fallback: true };
  }
  const generated = await AIService.generateContentKit(product, content_kits, aiBriefing, voz, userId);
  if (!generated) {
    // Última tentativa esgotada: entrega o roteiro base em vez de 503.
    try {
      const fallback = buildFallbackKit(product);
      const input = createContentKitSchema.parse(fallback);
      const contentKit = await createContentKit(product.id, input, { creatorId, briefing, usouVoz: false });
      return { content_kit: contentKit, created: true, fallback: true };
    } catch {
      throw createAppError(
        'SERVICE_UNAVAILABLE',
        'Não conseguimos gerar seu roteiro agora. Tente novamente em alguns segundos.',
        503,
      );
    }
  }

  const input = createContentKitSchema.parse(generated.content_kit);
  const contentKit = await createContentKit(product.id, input, { creatorId, briefing, usouVoz: temVoz });
  return { content_kit: contentKit, created: true };
}

async function createOnceWhilePending(productId: string, creatorId: string, briefing?: string, voz?: string | null, userId?: string, preferencesBriefing?: string) {
  const key = inflightKey(productId, creatorId, briefing, preferencesBriefing);
  const pending = contentKitCreationInFlight.get(key);
  if (pending) return pending;

  const creation = createContentKitResult(productId, creatorId, briefing, voz, userId, preferencesBriefing);
  contentKitCreationInFlight.set(key, creation);
  // Evita vazamento se a promise nunca assentar; limpa em 5min.
  const guard = setTimeout(() => {
    if (contentKitCreationInFlight.get(key) === creation) {
      contentKitCreationInFlight.delete(key);
    }
  }, 5 * 60 * 1000);
  guard.unref?.();
  try {
    return await creation;
  } finally {
    clearTimeout(guard);
    if (contentKitCreationInFlight.get(key) === creation) {
      contentKitCreationInFlight.delete(key);
    }
  }
}

/** Reutiliza o kit mais recente; só cria quando o produto ainda não possui nenhum. */
export async function ensureContentKit(productId: string, creatorId: string, briefing?: string, voz?: string | null, userId?: string, preferencesBriefing?: string) {
  const { content_kits } = await getProductById(productId, { creatorId });
  if (content_kits[0]) return { content_kit: content_kits[0], created: false };

  // Uma segunda leitura dentro do bloqueio evita duplicação por cliques simultâneos.
  const pending = contentKitCreationInFlight.get(inflightKey(productId, creatorId, briefing, preferencesBriefing));
  if (pending) return pending;
  return createOnceWhilePending(productId, creatorId, briefing, voz, userId, preferencesBriefing);
}

/** Cria deliberadamente uma nova versão quando o usuário pede outro roteiro. */
export function createFreshContentKit(productId: string, creatorId: string, briefing?: string, voz?: string | null, userId?: string, preferencesBriefing?: string) {
  return createOnceWhilePending(productId, creatorId, briefing, voz, userId, preferencesBriefing);
}

/** Exclui um roteiro do creator. A produção ligada a ele é removida em cascata. */
export async function deleteContentKit(productId: string, kitId: string, creatorId: string) {
  const kit = await findContentKitById(kitId);
  if (!kit || kit.product_id !== productId || kit.creator_id !== creatorId) {
    throw Errors.NOT_FOUND('Roteiro');
  }
  await removeContentKit(kitId);
  return { id: kitId };
}
