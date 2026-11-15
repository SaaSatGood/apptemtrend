import { listSearchableCatalog } from '../products/product.service.js';
import type { AssistantProductSearchInput } from './assistant.schema.js';
import type { Product } from '../../types/index.js';
import { AIService } from './ai.service.js';
import { AI_LIMITS } from '../../config/constants.js';
import { TtlCache } from '../../lib/cache.js';
import { env } from '../../config/env.js';

// Cache de resposta completa para buscas simples repetidas (sem product_ids).
// Em teste é bypassado para não vazar entre casos.
const responseCache = new TtlCache<{ message: string; interpreted_as: string[]; products: unknown[]; needs_clarification: boolean; meta: unknown }>(200);

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

/**
 * Temas do onboarding -> termos reais do catálogo. Usado só quando a busca é
 * genérica: preferências orientam a descoberta, mas nunca atropelam um pedido
 * explícito do creator.
 */
const THEME_TERMS: Record<string, string[]> = {
  beleza: ['beleza', 'maquiagem', 'cabelo', 'pele', 'batom'],
  casa: ['casa', 'domestico', 'cozinha', 'movel', 'textil', 'decoracao', 'organizacao', 'limpeza'],
  tecnologia: ['tecnologia', 'eletronico', 'celular', 'fone', 'computador', 'bateria'],
  fitness: ['fitness', 'esporte', 'treino', 'suplemento', 'academia'],
  moda: ['moda', 'roupa', 'camiseta', 'blusa', 'short', 'sapato', 'bolsa', 'joia'],
  lifestyle: ['lifestyle', 'casa', 'moda', 'beleza'],
  gastronomia: ['cozinha', 'alimento', 'bebida', 'utensilio', 'receita'],
  pets: ['pet', 'animal', 'cachorro', 'gato'],
  maternidade: ['maternidade', 'bebe', 'infantil'],
  games: ['game', 'brinquedo', 'passatempo', 'computador'],
  educacao: ['livro', 'educacao', 'papelaria', 'audio'],
  decoracao: ['decoracao', 'movel', 'textil', 'iluminacao', 'tapete'],
  acessorios: ['acessorio', 'joia', 'bolsa', 'mala'],
  organizacao: ['organizacao', 'domestico', 'tupperware', 'armazenamento'],
  automotivo: ['automotivo', 'moto', 'carro', 'ferramenta'],
  infantil: ['infantil', 'crianca', 'brinquedo', 'bebe'],
  esportes: ['esporte', 'fitness', 'treino', 'calcado'],
};

const OUTRO_PREFIX = /^outros?:\s*/i;
const OBJECTIVE_LABELS: Record<string, string> = {
  comecar_vender: 'começar a vender',
  vender_mais: 'vender mais',
  criar_videos: 'criar vídeos para produtos',
  explorando: 'explorar a plataforma',
};

/** "Outros: festas infantis" vira "festas infantis" para casar com o catálogo. */
function themeValue(value: string): string {
  return value.trim().replace(OUTRO_PREFIX, '').trim();
}

function preferenceTerms(prefs?: CreatorPrefs | null): string[] {
  const terms = new Set<string>();
  for (const raw of prefs?.temas_interesse ?? []) {
    const theme = themeValue(raw);
    if (!theme) continue;
    const mapped = THEME_TERMS[normalize(theme)];
    if (mapped) mapped.forEach((term) => terms.add(term));
    // Nicho personalizado ("Outros") também vira termo de busca.
    if (!mapped || /\s/.test(theme)) tokens(theme).forEach((term) => terms.add(term));
  }
  return [...terms];
}

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
  const temas = (prefs?.temas_interesse || []).map(themeValue).filter(Boolean);
  const hit = temas.find((tema) => {
    const t = normalize(tema);
    return t.length >= 3 && (categoria.includes(t) || t.includes(categoria));
  });
  return hit ? `Combina com seu tema ${hit}` : null;
}

function finalMotivo(product: Product, aiMotivo: string | null | undefined, prefs?: CreatorPrefs | null): string | null {
  const parts = [prefsClause(product, prefs), intrinsicMotivo(product, aiMotivo)].filter(Boolean) as string[];
  if (!parts.length) return null;
  return parts.join(' · ').slice(0, 140);
}

const MESSAGES = {
  clarify: 'O que você quer vender? Pode ser um nicho, uma faixa de preço ou só "não sei o que vender" — eu trago opções.',
  demonstrationClarify: 'Para sugerir algo fácil de gravar, diga um nicho ou produto. O catálogo não informa a facilidade de demonstração.',
  outOfScope: 'Por aqui eu só consigo ajudar com a TemTrend: escolher produto, montar roteiro e publicar seu vídeo. Me conta o que você quer vender que eu sigo com você.',
  empty: 'Não achei nada com esse filtro. Tenta descrever de outro jeito ou me diz outra faixa de preço.',
  discovery: 'Separei algumas opções para você começar. Abre uma e a gente monta o roteiro.',
  refined: 'Refinei as opções com o que você pediu.',
  keptPrevious: 'Não achei um produto novo com esse filtro. Mantive as opções anteriores.',
  selected: 'Boa escolha! Esse é o produto certo para começar.',
  chooseOne: 'Boa escolha. Toque em Ver produto para continuar.',
} as const;

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

export function isGreetingOnly(message: string) {
  return /^(oi|ola|bom dia|boa tarde|boa noite|e ai|hey|hello|tudo bem)[!?.\s]*$/.test(normalize(message.trim()));
}

function maximumPriceFrom(message: string): number | null {
  const normalized = normalize(message);
  const match = normalized.match(/(?:ate|abaixo de|menos de|no maximo)\s*(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)\s*(?:reais)?/)
    ?? normalized.match(/r\$\s*(\d+(?:[.,]\d{1,2})?)/);
  if (!match) return null;
  const value = Number(match[1].replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function requestedCountFrom(message: string): number | null {
  const normalized = normalize(message);
  const patterns = [
    /(?:quero|me (?:de|da|de)|mostre|liste|preciso de|busque)\s+(\d{1,2})\s*(?:produto|produtos|opcao|opcoes|resultado|resultados|item|itens)?/,
    /(\d{1,2})\s*(?:produto|produtos|opcao|opcoes|resultado|resultados|item|itens)\b/,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      const value = Number(match[1]);
      if (Number.isFinite(value) && value >= 1 && value <= 5) return value;
    }
  }
  return null;
}

function isDemonstrationRequest(message: string) {
  return /(?:facil|faceis)\s+de\s+(demonstrar|gravar|mostrar)|facilidade\s+de\s+(demonstrar|gravar|mostrar)/.test(normalize(message));
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

export function isWeeklyPlanRequest(message: string) {
  const normalized = normalize(message.trim());
  const period = /\b(?:semana|semanal|7 dias|sete dias|7 videos|sete videos|7 posts|sete posts)\b/.test(normalized);
  const planning = /\b(?:planej|prepar|cri|mont|ger|quero|preciso|roteir|conteud|post|video|produto|calendario|cronograma|minha semana)\w*/.test(normalized);
  return period && planning;
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

function countMessage(count: number, maximumPrice: number | null = null) {
  const pricePart = maximumPrice != null ? ` até R$ ${maximumPrice.toLocaleString('pt-BR')}` : '';
  return count === 1
    ? `Achei 1 produto para você${pricePart}.`
    : `Achei ${count} produtos para você${pricePart}.`;
}

type Decision = Awaited<ReturnType<typeof AIService.interpretIntent>>;

function buildResponse(
  message: string,
  products: Product[],
  terms: string[],
  decision: Decision,
  prefs?: CreatorPrefs | null,
  needsClarification = false,
) {
  const motivos = decision?.motivos ?? {};
  return {
    message,
    interpreted_as: terms.slice(0, 12),
    needs_clarification: needsClarification,
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

export async function findProductsForMessage(
  input: AssistantProductSearchInput,
  prefs?: CreatorPrefs | null,
  userId?: string,
) {
  if (isGreetingOnly(input.message)) {
    return buildResponse(MESSAGES.clarify, [], [], null, prefs, true);
  }
  const catalog = (await listSearchableCatalog()).filter(isSearchableCatalogProduct);
  if (isWeeklyPlanRequest(input.message)) {
    const planningWords = new Set(['semana', 'semanal', 'dias', 'sete', 'posts', 'post', 'conteudo', 'conteudos', 'roteiro', 'roteiros', 'planejar', 'planeje', 'planejamento', 'criar', 'crie', 'prepare', 'preparar', 'calendario', 'cronograma', 'minha', 'toda', 'todos', 'dia', 'cada']);
    const explicitTerms = expandedTerms(input.message).filter((term) => !planningWords.has(term) && !/^\d+$/.test(term));
    const terms = explicitTerms.length ? explicitTerms : preferenceTerms(prefs);
    const maximumPrice = maximumPriceFrom(input.message);
    const eligible = maximumPrice == null ? catalog : catalog.filter((product) => product.preco_min_brl != null && product.preco_min_brl <= maximumPrice);
    const ranked = rankProducts(eligible, terms);
    const matching = terms.length ? ranked.filter((item) => item.score > 0) : ranked;
    const ordered = [...matching, ...ranked.filter((item) => !matching.some((match) => match.product.id === item.product.id))];
    const chosen = ordered.slice(0, 7).map((item) => item.product);
    return {
      ...buildResponse(chosen.length ? `Separei ${chosen.length} ${chosen.length === 1 ? 'produto' : 'produtos'} para a sua semana. Já estou escrevendo os roteiros, as legendas e as hashtags.` : MESSAGES.empty, chosen, terms, null, prefs),
      weekly_plan_requested: true,
    };
  }
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
  // Preferências entram só na busca genérica: um pedido explícito manda mais.
  const prefTerms = localTerms.length === 0 ? preferenceTerms(prefs) : [];
  const rankingTerms = [...new Set([...localTerms, ...prefTerms])];
  const maximumPrice = maximumPriceFrom(input.message);
  const requestedCount = requestedCountFrom(input.message);
  const requestedIds = input.product_ids?.length ? new Set(input.product_ids) : null;
  const discovery = isDiscoveryRequest(input.message);

  // A continuidade só vale quando a mensagem não aponta um assunto novo.
  const outsideContext = Boolean(requestedIds)
    && rankProducts(catalog, localTerms).some((item) => item.score >= 5 && !requestedIds!.has(item.product.id));
  const isRefinement = Boolean(requestedIds) && !discovery && !outsideContext;
  const maxResults = isRefinement ? 5 : Math.min(Math.max(requestedCount ?? 1, 1), 5);
  const candidates = isRefinement
    ? catalog.filter((product) => requestedIds!.has(product.id))
    : catalog;
  const eligibleCandidates = maximumPrice == null
    ? candidates
    : candidates.filter((product) => product.preco_min_brl != null && product.preco_min_brl <= maximumPrice);

  if (!eligibleCandidates.length) {
    return buildResponse(MESSAGES.empty, [], localTerms, null, prefs);
  }

  // "Esse aqui" fecha a escolha sem gastar uma chamada de IA.
  if (isRefinement && isSelectionRequest(input.message)) {
    const chosen = rankProducts(eligibleCandidates, localTerms)
      .slice(0, maxResults)
      .map((item) => item.product);
    return buildResponse(
      eligibleCandidates.length === 1 ? MESSAGES.selected : MESSAGES.chooseOne,
      chosen,
      localTerms,
      null,
      prefs,
    );
  }

  // Pré-rank local: envia ao Gemini só o topo relevante (custo/latência).
  // Refinos já são pequenos; discovery usa topo por destaque+score.
  const aiCandidates = isRefinement
    ? eligibleCandidates.slice(0, AI_LIMITS.MAX_CATALOG_ITEMS)
    : rankProducts(eligibleCandidates, rankingTerms).slice(0, AI_LIMITS.MAX_CATALOG_ITEMS).map((item) => item.product);

  const decision = isRefinement
    ? await AIService.refineProductSearch(input.message, aiCandidates, userId)
    : await AIService.interpretIntent(input.message, aiCandidates, userId);

  if (decision && !decision.in_scope) {
    return buildResponse(MESSAGES.outOfScope, [], [], decision, prefs);
  }

  const terms = [...new Set([
    ...rankingTerms,
    ...(decision?.search_terms ?? []).map((term) => normalize(term)),
  ])];

  const ranked = rankProducts(eligibleCandidates, terms);
  const matched = ranked.filter((item) => item.score > 0 || maximumPrice != null);

  const selectedByModel = (decision?.selected_product_ids ?? [])
    .map((id) => eligibleCandidates.find((product) => product.id === id))
    .filter((product): product is Product => Boolean(product))
    .filter((product) => discovery || !localTerms.length || maximumPrice != null || isDemonstrationRequest(input.message) || scoreProduct(product, localTerms) > 0);

  let chosen: Product[] = [];
  let message: string;

  if (selectedByModel.length) {
    chosen = selectedByModel.slice(0, maxResults);
    message = isRefinement ? MESSAGES.refined : countMessage(chosen.length, maximumPrice);
  } else if (matched.length) {
    chosen = matched.slice(0, maxResults).map((item) => item.product);
    message = isRefinement ? MESSAGES.refined : countMessage(chosen.length, maximumPrice);
  } else if (isRefinement) {
    chosen = ranked.slice(0, maxResults).map((item) => item.product);
    message = MESSAGES.keptPrevious;
  } else if (discovery || (!localTerms.length && isProductCatalogRequest(input.message))) {
    chosen = ranked.slice(0, maxResults).map((item) => item.product);
    message = chosen.length ? MESSAGES.discovery : MESSAGES.empty;
  } else if (isDemonstrationRequest(input.message)) {
    return buildResponse(MESSAGES.demonstrationClarify, [], terms, decision, prefs, true);
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
