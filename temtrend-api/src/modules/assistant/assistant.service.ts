import { listSearchableCatalog } from '../products/product.service.js';
import type { AssistantProductSearchInput } from './assistant.schema.js';
import type { Product } from '../../types/index.js';
import { AIService } from './ai.service.js';
import { AI_LIMITS } from '../../config/constants.js';
import { env } from '../../config/env.js';

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

const MAX_RESULTS = 6;

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
    crescimento_vendas_percentual: product.crescimento_vendas_percentual,
    tiktok_shop_url: product.tiktok_shop_url,
    fastmoss_produto_url: product.fastmoss_produto_url,
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
) {
  return {
    message,
    interpreted_as: terms.slice(0, 12),
    products: products.map(publicProduct),
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

export async function findProductsForMessage(input: AssistantProductSearchInput) {
  const catalog = (await listSearchableCatalog()).filter(isSearchableCatalogProduct);
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
    return buildResponse(MESSAGES.empty, [], localTerms, null);
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
    return buildResponse(MESSAGES.outOfScope, [], [], decision);
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
    return buildResponse(MESSAGES.empty, [], terms, decision);
  }

  if (!chosen.length) {
    return buildResponse(MESSAGES.empty, [], terms, decision);
  }

  return buildResponse(message, chosen, terms, decision);
}
