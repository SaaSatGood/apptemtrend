import { env } from '../../config/env.js';
import { AI_LIMITS } from '../../config/constants.js';
import { TtlCache } from '../../lib/cache.js';
import { recordAssistantCall, recordGenerateCall } from '../../lib/ai-metrics.js';
import { logger } from '../../lib/logger.js';
import type { ContentKit, Product } from '../../types/index.js';
import {
  CONTENT_STRATEGY_INSTRUCTIONS,
  HUMAN_VOICE_INSTRUCTIONS,
  ROTEIRO_SKELETON_INSTRUCTIONS,
  SCRIPT_CRAFT_INSTRUCTIONS,
  isContentKitNovel,
  isScriptSpecific,
  missingStrategySections,
  parseGeneratedPackage,
  type GeneratedContentKit,
} from './gemini-generation.service.js';
import { CLASSIFICATION_INSTRUCTIONS, parseAndConstrainDecision, type GeminiCatalogDecision } from './gemini.service.js';

/**
 * Provedor OpenCode Go (Console): API compatível com OpenAI Chat Completions.
 * Endpoint: https://opencode.ai/inference/go/openai/v1/chat/completions
 * Modelo padrão: deepseek-v4.1-flash.
 *
 * Particularidades do Go:
 * - exige User-Agent próprio do cliente (não o padrão de SDK/HTTP);
 * - `x-opencode-session` estável por conversa melhora roteamento/cache de prompt;
 * - modelos de raciocínio contam os tokens de "thinking" no max_tokens, então
 *   usamos reasoning_effort=none nos fluxos que exigem JSON fechado.
 */

const USER_AGENT = 'temtrend-api/1.0';

// Mesmo cache do Gemini/OpenRouter: decisão por mensagem + snapshot do catálogo.
const decisionCache = new TtlCache<GeminiCatalogDecision>(500);

function chatEndpoint() {
  return `${env.OPENCODE_BASE_URL.replace(/\/+$/, '')}/chat/completions`;
}

/** Sessão estável por creator (roteamento e cache de prompt do Go). */
export function opencodeSessionId(userId?: string) {
  const suffix = (userId ?? 'anon').replace(/[^a-zA-Z0-9_-]/g, '');
  return `temtrend-${suffix}`.slice(0, 64);
}

interface OpenCodeChoice {
  message?: { content?: string | null };
  finish_reason?: string | null;
}

interface OpenCodeUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  completion_tokens_details?: { reasoning_tokens?: number } | null;
}

function stripJsonFence(text: string) {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
}

/** Schema no formato da API OpenAI (strict) — o Go repassa para o modelo. */
type ResponseFormat =
  | { type: 'json_object' }
  | { type: 'json_schema'; json_schema: { name: string; strict: true; schema: Record<string, unknown> } };

const DECISION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['in_scope', 'intent_summary', 'search_terms', 'selected_product_ids', 'motivos'],
  properties: {
    in_scope: { type: 'boolean' },
    intent_summary: { type: 'string' },
    search_terms: { type: 'array', items: { type: 'string' } },
    selected_product_ids: { type: 'array', items: { type: 'string' } },
    motivos: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['product_id', 'motivo'],
        properties: {
          product_id: { type: 'string' },
          motivo: { type: 'string' },
        },
      },
    },
  },
} as const;

const CONTENT_KIT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['product', 'content_kit'],
  properties: {
    product: {
      type: 'object',
      additionalProperties: false,
      required: ['nome', 'descricao', 'categoria'],
      properties: {
        nome: { type: 'string' },
        descricao: { type: 'string' },
        categoria: { type: 'string' },
      },
    },
    content_kit: {
      type: 'object',
      additionalProperties: false,
      required: [
        'titulo', 'descricao', 'formato', 'plataforma', 'nivel_dificuldade', 'hook', 'roteiro',
        'cenas', 'copy', 'cta', 'hashtags', 'audio_sugerido', 'duracao_seg',
      ],
      properties: {
        titulo: { type: 'string' },
        descricao: { type: 'string' },
        formato: { type: 'string' },
        plataforma: { type: 'string' },
        nivel_dificuldade: { type: 'string' },
        hook: { type: 'string' },
        roteiro: { type: 'string' },
        cenas: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['numero', 'tempo', 'visual', 'fala', 'acao_edicao'],
            properties: {
              numero: { type: 'integer' },
              tempo: { type: 'string' },
              visual: { type: 'string' },
              fala: { type: 'string' },
              acao_edicao: { type: 'string' },
            },
          },
        },
        copy: { type: 'string' },
        cta: { type: 'string' },
        hashtags: { type: 'array', items: { type: 'string' } },
        audio_sugerido: { type: 'string' },
        duracao_seg: { type: 'integer' },
      },
    },
  },
} as const;

async function chatCompletion(params: {
  system: string;
  user: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  userId?: string;
  responseFormat?: ResponseFormat;
}): Promise<{ text: string; usage: OpenCodeUsage }> {
  const response = await fetch(chatEndpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.OPENCODE_API_KEY}`,
      'User-Agent': USER_AGENT,
      'x-opencode-session': opencodeSessionId(params.userId),
    },
    body: JSON.stringify({
      model: env.OPENCODE_MODEL,
      messages: [
        { role: 'system', content: params.system },
        { role: 'user', content: params.user },
      ],
      temperature: params.temperature,
      max_tokens: params.maxTokens,
      response_format: params.responseFormat ?? { type: 'json_object' },
      reasoning_effort: env.OPENCODE_REASONING_EFFORT,
    }),
    signal: AbortSignal.timeout(params.timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`OpenCode HTTP ${response.status}`);
  }
  const payload = (await response.json()) as { choices?: OpenCodeChoice[]; usage?: OpenCodeUsage };
  const choice = payload.choices?.[0];
  // Sem isso o JSON vem cortado e o parse falha por um motivo enganoso.
  if (choice?.finish_reason === 'length') {
    throw new Error('OpenCode response truncated by max_tokens');
  }
  const text = stripJsonFence(choice?.message?.content ?? '');
  if (!text) throw new Error('OpenCode returned empty content');
  return { text, usage: payload.usage ?? {} };
}

function normalizeMessage(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim().slice(0, 200);
}

function decisionCacheKey(message: string, ids: string[]) {
  const sorted = [...ids].sort().join(',');
  let hash = 0;
  for (let i = 0; i < sorted.length; i += 1) {
    hash = (hash * 31 + sorted.charCodeAt(i)) | 0;
  }
  return `oc|${normalizeMessage(message)}|${ids.length}|${hash}`;
}

function truncate(value: string | null | undefined, max: number) {
  const text = (value ?? '').trim();
  return text.length > max ? text.slice(0, max) : text;
}

const CLASSIFY_JSON_HINT = [
  'Responda só o JSON pedido, com as chaves exatas:',
  '{"in_scope":boolean,"intent_summary":string,"search_terms":string[],"selected_product_ids":string[],',
  '"motivos":[{"product_id":string,"motivo":string}]}.',
].join(' ');

export async function classifyCatalogRequest(
  message: string,
  products: Product[],
  userId?: string,
): Promise<GeminiCatalogDecision | null> {
  if (!env.OPENCODE_API_KEY || env.NODE_ENV === 'test') return null;

  const allowedIds = new Set(products.map((product) => product.id));
  const cacheKey = decisionCacheKey(message, [...allowedIds]);
  const cached = decisionCache.get(cacheKey);
  if (cached) {
    logger.info({ cached: true, provider: 'opencode', selected_products: cached.selected_product_ids.length }, 'Assistant classification cache hit');
    recordAssistantCall(userId, 0, 0, true);
    return cached;
  }

  // Payload mínimo para intenção: só semântica (id/nome/categoria/desc).
  const catalog = products.slice(0, AI_LIMITS.MAX_CATALOG_ITEMS).map((product) => ({
    id: product.id,
    nome: truncate(product.nome, AI_LIMITS.MAX_NAME_CHARS),
    categoria: truncate(product.categoria, 40),
    descricao: truncate(product.descricao, AI_LIMITS.MAX_DESCRIPTION_CHARS),
  }));
  const startedAt = Date.now();
  const systemText = [CLASSIFICATION_INSTRUCTIONS, CLASSIFY_JSON_HINT].join(' ');
  const userText = JSON.stringify({ mensagem: message, catalogo: catalog });

  try {
    const { text, usage } = await chatCompletion({
      system: systemText,
      user: userText,
      temperature: 0,
      maxTokens: AI_LIMITS.CLASSIFY_MAX_OUTPUT_TOKENS,
      timeoutMs: AI_LIMITS.CLASSIFY_TIMEOUT_MS,
      userId,
      responseFormat: {
        type: 'json_schema',
        json_schema: { name: 'catalog_decision', strict: true, schema: DECISION_SCHEMA },
      },
    });
    const decision = parseAndConstrainDecision(text, allowedIds);
    const latencyMs = Date.now() - startedAt;
    const result = {
      ...decision,
      provider: 'opencode' as const,
      usage: {
        prompt_tokens: usage.prompt_tokens ?? 0,
        response_tokens: usage.completion_tokens ?? 0,
        thoughts_tokens: usage.completion_tokens_details?.reasoning_tokens ?? 0,
        total_tokens: usage.total_tokens ?? 0,
      },
      latency_ms: latencyMs,
    };
    logger.info({ provider: 'opencode', model: env.OPENCODE_MODEL, in_scope: decision.in_scope, selected_products: decision.selected_product_ids.length, usage: result.usage, latency_ms: latencyMs, catalog_items: catalog.length }, 'Assistant classification completed');
    recordAssistantCall(userId, systemText.length + userText.length, result.usage.total_tokens, false);
    decisionCache.set(cacheKey, result, AI_LIMITS.CLASSIFY_CACHE_TTL_MS);
    return result;
  } catch (error) {
    logger.warn({ err: error, provider: 'opencode', model: env.OPENCODE_MODEL, latency_ms: Date.now() - startedAt }, 'Assistant classification failed; using local fallback');
    return null;
  }
}

function truncateVoice(value?: string | null) {
  const text = (value ?? '').trim().replace(/\s+/g, ' ');
  if (!text) return undefined;
  return text.length > 500 ? text.slice(0, 500) : text;
}

function truncateBriefing(value?: string) {
  const text = (value ?? '').trim().replace(/\s+/g, ' ');
  if (!text) return undefined;
  return text.length > AI_LIMITS.MAX_BRIEFING_CHARS ? text.slice(0, AI_LIMITS.MAX_BRIEFING_CHARS) : text;
}

export async function generateContentKit(
  product: Product,
  previousKits: Partial<ContentKit>[] = [],
  creatorBriefing?: string,
  creatorVoice?: string | null,
  userId?: string,
): Promise<GeneratedContentKit | null> {
  if (!env.OPENCODE_API_KEY || env.NODE_ENV === 'test') return null;
  const startedAt = Date.now();
  const voice = truncateVoice(creatorVoice);
  let corrections: string[] = [];

  for (let attempt = 1; attempt <= AI_LIMITS.MAX_GENERATION_ATTEMPTS; attempt += 1) try {
    const systemText = [
      CONTENT_STRATEGY_INSTRUCTIONS,
      'Use só dados reais do produto. Entregue todos os campos do schema, abordagem inédita vs roteiros anteriores, sem genéricos/placeholders.',
      'Siga o briefing do creator sem contradizer dados reais. Vídeo gravado fora da TemTrend. Hashtags com # sem espaços.',
      voice
        ? 'Escreva hook, falas e copy no jeito de falar do creator (amostra abaixo); o briefing pontual prevalece em conflito. Nunca mude dados reais para combinar com a amostra.'
        : 'Sem amostra de voz; use um tom direto e prático.',
      HUMAN_VOICE_INSTRUCTIONS,
      SCRIPT_CRAFT_INSTRUCTIONS,
      ROTEIRO_SKELETON_INSTRUCTIONS,
      'Responda só JSON com as chaves "product" e "content_kit".',
      'As seções de estratégia (variações de hook, versão sem seguidores, dica de publicação, variações de roteiro) ficam DENTRO do campo roteiro, nunca como chaves novas.',
      'hashtags é um array de strings; cenas[].numero e duracao_seg são números inteiros.',
    ].join(' ');
    const userText = JSON.stringify({
      produto: {
        nome: product.nome.trim().slice(0, 120),
        descricao: (product.descricao?.trim() || '').slice(0, AI_LIMITS.MAX_PRODUCT_DESC_CHARS),
        categoria: (product.categoria?.trim() || 'Geral').slice(0, 60),
        loja: product.loja_nome?.trim().slice(0, 60) ?? null,
        preco: product.preco_texto,
        preco_min_brl: product.preco_min_brl,
        preco_max_brl: product.preco_max_brl,
        comissao_percentual: product.comissao_percentual,
        unidades_vendidas_periodo: product.unidades_vendidas_periodo,
        crescimento_vendas_percentual: product.crescimento_vendas_percentual,
        status_origem: product.status_origem,
      },
      orientacoes_do_creator: truncateBriefing(creatorBriefing) || 'Sem orientação adicional; crie uma abordagem clara e prática.',
      ...(voice ? { voz_do_creator: voice } : {}),
      ...(corrections.length ? { correcao_obrigatoria: `Na tentativa anterior: ${corrections.join('; ')}.` } : {}),
      contexto_temporal: { data_iso: new Date().toISOString(), pais: 'Brasil' },
      tentativa: attempt,
    });
    const { text, usage } = await chatCompletion({
      system: systemText,
      user: userText,
      temperature: 0.7,
      maxTokens: AI_LIMITS.GENERATE_MAX_OUTPUT_TOKENS,
      timeoutMs: AI_LIMITS.GENERATE_TIMEOUT_MS,
      userId,
      responseFormat: {
        type: 'json_schema',
        json_schema: { name: 'content_kit', strict: true, schema: CONTENT_KIT_SCHEMA },
      },
    });
    recordGenerateCall(systemText.length + userText.length, usage.total_tokens ?? 0, attempt - 1, userId);
    const generated = parseGeneratedPackage(JSON.stringify({
      product: { nome: product.nome, descricao: product.descricao, categoria: product.categoria },
      content_kit: JSON.parse(text).content_kit,
    }));
    if (missingStrategySections(generated.content_kit.roteiro).length > 0) {
      corrections = [`faltaram estas seções do roteiro; inclua TODAS com estes títulos exatos: ${missingStrategySections(generated.content_kit.roteiro).join(' | ')}`];
      logger.warn({ product_name: product.nome, attempt, missing: missingStrategySections(generated.content_kit.roteiro), provider: 'opencode' }, 'Generated content kit was incomplete; retrying');
      continue;
    }
    if (!isScriptSpecific(generated.content_kit, product) && attempt === 1) {
      corrections = ['o roteiro servia para qualquer produto; cite o detalhe concreto deste produto no hook e em pelo menos duas cenas'];
      logger.warn({ product_name: product.nome, attempt, provider: 'opencode' }, 'Generated content kit was generic; retrying once');
      continue;
    }
    if (!isContentKitNovel(generated.content_kit, previousKits)) {
      corrections = ['o kit ficou parecido com uma versão anterior; mude o ângulo, o hook e a primeira cena'];
      logger.warn({ product_name: product.nome, attempt, provider: 'opencode' }, 'Generated content kit was too similar; retrying');
      continue;
    }
    const latencyMs = Date.now() - startedAt;
    logger.info({ provider: 'opencode', model: env.OPENCODE_MODEL, usage, latency_ms: latencyMs }, 'Content kit generated');
    return { content_kit: generated.content_kit, usage: { prompt_tokens: 0, response_tokens: 0, thoughts_tokens: 0, total_tokens: usage.total_tokens ?? 0 }, latency_ms: latencyMs };
  } catch (error) {
    logger.warn({ err: error, attempt, provider: 'opencode', model: env.OPENCODE_MODEL, latency_ms: Date.now() - startedAt }, 'Content kit generation attempt failed');
  }
  return null;
}
