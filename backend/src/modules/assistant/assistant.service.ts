import { listSearchableCatalog } from '../products/product.service.js';
import type { AssistantProductSearchInput } from './assistant.schema.js';
import type { Product } from '../../types/index.js';
import { AIService } from './ai.service.js';
import { AI_LIMITS } from '../../config/constants.js';
import { TtlCache } from '../../lib/cache.js';
import { env } from '../../config/env.js';

// Cache de resposta completa para buscas simples repetidas (sem product_ids).
// Em teste é bypassado para não vazar entre casos.
const responseCache = new TtlCache<{ message: string; interpreted_as: string[]; products: unknown[]; meta: unknown }>(200);

function responseCacheKey(message: string) {
  return message.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim().slice(0, 200);
}

function catalogFingerprint(catalog: Product[]) {
  let hash = 0;
  const ids = catalog.map((p) => p.id).sort().join(',');
  for (let i = 0; i < ids.length; i += 1) {
    hash = (hash * 31 + ids.charCodeAt(i)) | 0;
  }
  return `${hash}`;
}

const STOP_WORDS = new Set([
  'a', 'algo', 'as', 'com', 'coisa', 'coisas', 'de', 'do', 'dos', 'e', 'eu',
  'facil', 'fazer', 'me', 'nao', 'o', 'os', 'para', 'produto', 'produtos',
  'que', 'quero', 'um', 'uma', 'vender', 'video', 'videos',
]);

const INTENT_TERMS: Record<string, string[]> = {
  fitness: ['academia', 'fitness', 'treino', 'exercicio', 'esporte', 'musculacao'],
  casa: ['casa', 'lar', 'organizacao', 'organizador', 'decoracao', 'limpeza'],
  beleza: ['beleza', 'skincare', 'maquiagem', 'cosmetico', 'cabelo', 'pele'],
  cozinha: ['cozinha', 'culinaria', 'gastronomia', 'receita', 'utensilio'],
  tecnologia: ['tecnologia', 'eletronico', 'gadget', 'celular', 'fone'],
  moda: ['moda', 'roupa', 'acessorio', 'look'],
};

const MAX_RESULTS = 5;

export interface CreatorPrefs {
  temas_interesse?: string[] | null;
  estilos_conteudo?: string[] | null;
}

function prefsFingerprint(prefs?: CreatorPrefs | null): string {
  const temas = (prefs?.temas_interesse || []).map(normalize).filter(Boolean).sort().join(',');
  const estilos = (prefs?.estilos_conteudo || []).map(normalize).filter(Boolean).sort().join(',');
  let hash = 0;
  const raw = `${temas}|${estilos}`;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) | 0;
  }
  return `${hash}`;
}

// Motivo intrínseco: só dados reais do produto (ou frase da IA, já limitada
// a preço/comissão/vendas/categoria no prompt). Nunca inventa atributo.
function intrinsicMotivo(product: Product, aiMotivo?: string | null): string | null {
  if (aiMotivo?.trim()) return aiMotivo.trim().replace(/\s+/g, ' ').slice(0, 140);
  const clauses: string[] = [];
  const sold = product.unidades_vendidas_total ?? product.unidades_vendidas_periodo;
  if (product.preco_min_brl != null && product.preco_min_brl <= 50) clauses.push('Preço acessível');
  if (product.comissao_percentual != null) clauses.push(`Comissão de ${product.comissao_percentual}%`);
  if (sold != null) clauses.push(`${sold.toLocaleString('pt-BR')} vendidos`);
  if (!clauses.length) return 'Selecionado para a sua busca';
  return clauses.slice(0, 2).join(' · ');
}

function prefsClause(product: Product, prefs?: CreatorPrefs | null): string | null {
  const categoria = normalize(product.categoria || '');
  if (!categoria) return null;
  const temas = (prefs?.temas_interesse || []).filter((t) => t && t.trim());
  const hit = temas.find((tema) => {
    const t = normalize(tema);
    return t.length >= 3 && (categoria.includes(t) || t.includes(categoria));
  });
  return hit ? `Combina com seu tema ${hit.trim()}` : null;
}

function finalMotivo(product: Product, aiMotivo: string | null | undefined, prefs?: CreatorPrefs | null): string | null {
  const parts = [prefsClause(product, prefs), intrinsicMotivo(product, aiMotivo)].filter(Boolean) as string[];
  if (!parts.length) return null;
  return parts.join(' · ').slice(0, 140);
}

const MESSAGES = {
  outOfScope: 'Posso te ajudar a encontrar produtos e a preparar seu conteúdo. Conte o que você quer vender.',
  empty: 'Não encontrei um produto para essa busca. Experimente descrever de outra forma.',
  discovery: 'Separei algumas opções para você começar.',
  refined: 'Refinei as opções com o que você pediu.',
  keptPrevious: 'Não achei um produto novo com esse filtro. Mantive as opções anteriores.',
  selected: 'Boa escolha. Esse é o produto certo para começar.',
  chooseOne: 'Boa escolha. Toque em Ver produto para continuar.',
} as const;

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

function tokens(value: string) {
  return normalize(value).split(/[^a-z0-9]+/).filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function expandedTerms(message: string) {
  const direct = new Set(tokens(message));
  const normalized = normalize(message);
  for (const [intent, terms] of Object.entries(INTENT_TERMS)) {
    if (terms.some((term) => normalized.includes(term))) {
      direct.add(intent);
      terms.forEach((term) => direct.add(term));
    }
  }
  return [...direct];
}

export function isProductCatalogRequest(message: string) {
  const normalized = normalize(message);
  return /\b(produto|produtos|vender|crie|criar|ideia|achadinho|achadinhos)\b/.test(normalized)
    || /\bquero\s+(algo|um|uma)\b/.test(normalized);
}

const DISCOVERY_REQUESTS = [
  /nao sei o que vender/,
  /nao sei por onde comecar/,
  /nao sei o que$/,
  /quero (uma )?ideia/,
  /crie? (uma )?ideia/,
  /me de uma ideia/,
  /qualquer coisa/,
  /me surpreenda/,
];

export function isDiscoveryRequest(message: string) {
  const normalized = normalize(message.trim());
  return DISCOVERY_REQUESTS.some((pattern) => pattern.test(normalized));
}

const SELECTION_REQUESTS = [
  /\besse aqui\b/, /\bessa aqui\b/,
  /\bquero esse\b/, /\bquero essa\b/,
  /\bvou com esse\b/, /\bvou com essa\b/,
  /\besse produto\b/, /\bessa produto\b/,
  /^esse$/, /^essa$/, /^esse sim$/,
];

export function isSelectionRequest(message: string) {
  const normalized = normalize(message.trim());
  return SELECTION_REQUESTS.some((pattern) => pattern.test(normalized));
}

function scoreProduct(product: Product, terms: string[]) {
  const name = normalize(product.nome);
  const category = normalize(product.categoria || '');
  const description = normalize(product.descricao || '');
  return terms.reduce((score, term) => {
    if (category.includes(term)) score += 8;
    if (name.includes(term)) score += 5;
    if (description.includes(term)) score += 2;
    return score;
  }, 0);
}

function publicProduct(product: Product) {
  // Vitrine enxuta: só o que o card usa + sinais do motivo.
  return {
    id: product.id,
    produto_externo_id: product.produto_externo_id,
    nome: product.nome,
    descricao: product.descricao,
    imagem_url: product.imagem_url,
    categoria: product.categoria,
    loja_nome: product.loja_nome,
    preco_texto: product.preco_texto,
    preco_min_brl: product.preco_min_brl,
    preco_max_brl: product.preco_max_brl,
    comissao_percentual: product.comissao_percentual,
    unidades_vendidas_periodo: product.unidades_vendidas_periodo,
    unidades_vendidas_total: product.unidades_vendidas_total,
    tiktok_shop_url: product.tiktok_shop_url,
  };
}

function countMessage(count: number) {
  return count === 1
    ? 'Encontrei 1 produto para você.'
    : `Encontrei ${count} produtos para você.`;
}

type Decision = Awaited<ReturnType<typeof AIService.interpretIntent>>;

function buildResponse(
  message: string,
  products: Product[],
  terms: string[],
  decision: Decision,
  prefs?: CreatorPrefs | null,
) {
  const motivos = decision?.motivos ?? {};  return {
    message,
    interpreted_as: terms.slice(0, 12),
    products: products.map((product) => ({
      ...publicProduct(product),
      motivo: finalMotivo(product, motivos[product.id], prefs),
    })),
    meta: decision ? {
      provider: decision.provider,
      model: env.GEMINI_MODEL,
      usage: decision.usage,
      latency_ms: decision.latency_ms,
    } : {
      provider: 'local' as const,
      model: null,
      usage: null,
      latency_ms: null,
    },
  };
}

function rankProducts(products: Product[], terms: string[]) {
  return products
    .map((product) => ({ product, score: scoreProduct(product, terms) }))
    .sort((a, b) => b.score - a.score || Number(b.product.destaque) - Number(a.product.destaque));
}

/**
 * Produtos criados pelo fluxo antigo da IA eram persistidos sem imagem.
 * O assistente só pode pesquisar itens que fazem parte do catálogo utilizável;
 * assim, esses registros legados não voltam a aparecer nas recomendações.
 */
export function isSearchableCatalogProduct(product: Product) {
  return Boolean(product.imagem_url?.trim());
}

export async function findProductsForMessage(input: AssistantProductSearchInput, prefs?: CreatorPrefs | null) {
  const catalog = (await listSearchableCatalog()).filter(isSearchableCatalogProduct);
  // Cache isolado por mensagem + snapshot do catálogo + preferências:
  // nunca serve produtos nem motivos de outro contexto.
  const useResponseCache = env.NODE_ENV !== 'test' && !input.product_ids?.length;
  const cacheKey = useResponseCache
    ? `${responseCacheKey(input.message)}|${prefsFingerprint(prefs)}|${catalog.length}|${catalogFingerprint(catalog)}`
    : null;
  if (cacheKey) {
    const cached = responseCache.get(cacheKey);
    if (cached) return cached as ReturnType<typeof buildResponse>;
  }
  const localTerms = expandedTerms(input.message);
  const requestedIds = input.product_ids?.length ? new Set(input.product_ids) : null;
  const discovery = isDiscoveryRequest(input.message);

  // A continuidade só vale quando a mensagem não aponta um assunto novo.
  const outsideContext = Boolean(requestedIds)
    && rankProducts(catalog, localTerms).some((item) => item.score >= 5 && !requestedIds!.has(item.product.id));
  const isRefinement = Boolean(requestedIds) && !discovery && !outsideContext;
  const candidates = isRefinement
    ? catalog.filter((product) => requestedIds!.has(product.id))
    : catalog;

  if (!candidates.length) {
    return buildResponse(MESSAGES.empty, [], localTerms, null, prefs);
  }

  // "Esse aqui" fecha a escolha sem gastar uma chamada de IA.
  if (isRefinement && isSelectionRequest(input.message)) {
    const chosen = rankProducts(candidates, localTerms)
      .slice(0, MAX_RESULTS)
      .map((item) => item.product);
    return buildResponse(
      candidates.length === 1 ? MESSAGES.selected : MESSAGES.chooseOne,
      chosen,
      localTerms,
      null,
      prefs,
    );
  }

  // Pré-rank local: envia ao Gemini só o topo relevante (custo/latência).
  // Refinos já são pequenos; discovery usa topo por destaque+score.
  const aiCandidates = isRefinement
    ? candidates.slice(0, AI_LIMITS.MAX_CATALOG_ITEMS)
    : rankProducts(candidates, localTerms).slice(0, AI_LIMITS.MAX_CATALOG_ITEMS).map((item) => item.product);

  const decision = isRefinement
    ? await AIService.refineProductSearch(input.message, aiCandidates)
    : await AIService.interpretIntent(input.message, aiCandidates);

  if (decision && !decision.in_scope) {
    return buildResponse(MESSAGES.outOfScope, [], [], decision, prefs);
  }

  const terms = [...new Set([
    ...localTerms,
    ...(decision?.search_terms ?? []).map((term) => normalize(term)),
  ])];

  const ranked = rankProducts(candidates, terms);
  const matched = ranked.filter((item) => item.score > 0);

  const selectedByModel = (decision?.selected_product_ids ?? [])
    .map((id) => candidates.find((product) => product.id === id))
    .filter((product): product is Product => Boolean(product));

  let chosen: Product[] = [];
  let message: string;

  if (selectedByModel.length) {
    chosen = selectedByModel.slice(0, MAX_RESULTS);
    message = isRefinement ? MESSAGES.refined : countMessage(chosen.length);
  } else if (matched.length) {
    chosen = matched.slice(0, MAX_RESULTS).map((item) => item.product);
    message = isRefinement ? MESSAGES.refined : countMessage(chosen.length);
  } else if (isRefinement) {
    chosen = ranked.slice(0, MAX_RESULTS).map((item) => item.product);
    message = MESSAGES.keptPrevious;
  } else if (discovery || isProductCatalogRequest(input.message)) {
    chosen = ranked.slice(0, MAX_RESULTS).map((item) => item.product);
    message = chosen.length ? MESSAGES.discovery : MESSAGES.empty;
  } else {
    return buildResponse(MESSAGES.empty, [], terms, decision, prefs);
  }

  if (!chosen.length) {
    return buildResponse(MESSAGES.empty, [], terms, decision, prefs);
  }

  const response = buildResponse(message, chosen, terms, decision, prefs);
  if (cacheKey) responseCache.set(cacheKey, response as never, AI_LIMITS.ASSISTANT_RESPONSE_CACHE_TTL_MS);
  return response;
}
