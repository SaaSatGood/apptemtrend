import { z } from 'zod';
import { env } from '../../config/env.js';
import { AI_LIMITS } from '../../config/constants.js';
import { recordGenerateCall } from '../../lib/ai-metrics.js';
import { logger } from '../../lib/logger.js';
import type { AssistantUsage } from './gemini.service.js';
import type { ContentKit, Product } from '../../types/index.js';

export const generatedPackageSchema = z.object({
  product: z.object({
    nome: z.string().trim().min(3).max(120),
    descricao: z.string().trim().min(20).max(1200),
    categoria: z.string().trim().min(2).max(100),
  }).strict(),
  content_kit: z.object({
    titulo: z.string().trim().min(3).max(200).refine(
      (title) => title.split(/\s+/).length <= 8,
      'O título deve ter no máximo 8 palavras.',
    ),
    descricao: z.string().trim().min(20).max(2000),
    formato: z.string().trim().min(2).max(100),
    plataforma: z.string().trim().min(2).max(100),
    nivel_dificuldade: z.string().trim().min(2).max(50),
    hook: z.string().trim().min(10).max(500),
    roteiro: z.string().trim().min(100).max(10000),
    cenas: z.array(z.object({
      numero: z.number().int().positive(),
      tempo: z.string().trim().min(2).max(30),
      visual: z.string().trim().min(3).max(500),
      fala: z.string().trim().min(1).max(800),
      acao_edicao: z.string().trim().min(3).max(500),
    }).strict()).min(3).max(8),
    copy: z.string().trim().min(10).max(150),
    cta: z.string().trim().min(3).max(500),
    hashtags: z.array(z.string().trim().min(2).max(60)).length(5),
    audio_sugerido: z.string().trim().min(3).max(200),
    duracao_seg: z.number().int().min(15).max(30),
  }).strict(),
}).strict();

const geminiResponseSchema = z.object({
  candidates: z.array(z.object({
    content: z.object({
      parts: z.array(z.object({ text: z.string() }).passthrough()),
    }).passthrough(),
  }).passthrough()).min(1),
  usageMetadata: z.object({
    promptTokenCount: z.number().optional(),
    candidatesTokenCount: z.number().optional(),
    thoughtsTokenCount: z.number().optional(),
    totalTokenCount: z.number().optional(),
  }).passthrough().optional(),
}).passthrough();

const PACKAGE_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    product: {
      type: 'OBJECT',
      properties: {
        nome: { type: 'STRING' }, descricao: { type: 'STRING' }, categoria: { type: 'STRING' },
      },
      required: ['nome', 'descricao', 'categoria'],
    },
    content_kit: {
      type: 'OBJECT',
      properties: {
        titulo: { type: 'STRING' }, descricao: { type: 'STRING' }, formato: { type: 'STRING' },
        plataforma: { type: 'STRING' }, nivel_dificuldade: { type: 'STRING' }, hook: { type: 'STRING' },
        roteiro: { type: 'STRING' },
        cenas: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              numero: { type: 'INTEGER' }, tempo: { type: 'STRING' }, visual: { type: 'STRING' },
              fala: { type: 'STRING' }, acao_edicao: { type: 'STRING' },
            },
            required: ['numero', 'tempo', 'visual', 'fala', 'acao_edicao'],
          },
        },
        copy: { type: 'STRING' }, cta: { type: 'STRING' },
        hashtags: { type: 'ARRAY', items: { type: 'STRING' } },
        audio_sugerido: { type: 'STRING' }, duracao_seg: { type: 'INTEGER' },
      },
      required: [
        'titulo', 'descricao', 'formato', 'plataforma', 'nivel_dificuldade', 'hook', 'roteiro',
        'cenas', 'copy', 'cta', 'hashtags', 'audio_sugerido', 'duracao_seg',
      ],
    },
  },
  required: ['product', 'content_kit'],
} as const;

function usageFromResponse(response: z.infer<typeof geminiResponseSchema>): AssistantUsage {
  const usage = response.usageMetadata;
  return {
    prompt_tokens: usage?.promptTokenCount ?? 0,
    response_tokens: usage?.candidatesTokenCount ?? 0,
    thoughts_tokens: usage?.thoughtsTokenCount ?? 0,
    total_tokens: usage?.totalTokenCount ?? 0,
  };
}

function normalizeHashtags(tags: string[]) {
  const hashtags = [...new Set(tags.map((tag) => {
    const clean = tag.replace(/^#+/, '').replace(/\s+/g, '');
    return `#${clean}`;
  }))].filter((tag) => tag.length > 1).slice(0, 12);
  if (hashtags.length < 3) throw new Error('Content kit returned insufficient hashtags');
  return hashtags;
}

function normalizeCta(cta: string) {
  return /(?:https?:\/\/|www\.|\blink\b|\bbio\b|\bdirect\b)/i.test(cta)
    ? 'Confira o produto no carrinho do vídeo, se ele estiver disponível para você.'
    : cta;
}

export function parseGeneratedPackage(text: string) {
  const generated = generatedPackageSchema.parse(JSON.parse(text));
  return {
    ...generated,
    content_kit: {
      ...generated.content_kit,
      hashtags: normalizeHashtags(generated.content_kit.hashtags),
      cta: normalizeCta(generated.content_kit.cta),
    },
  };
}

const CONTENT_KIT_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    content_kit: PACKAGE_RESPONSE_SCHEMA.properties.content_kit,
  },
  required: ['content_kit'],
} as const;

export type GeneratedContentKit = {
  content_kit: z.infer<typeof generatedPackageSchema>['content_kit'];
  usage: AssistantUsage;
  latency_ms: number;
};

const MAX_GENERATION_ATTEMPTS = AI_LIMITS.MAX_GENERATION_ATTEMPTS;

function comparableText(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordSet(value: unknown) {
  return new Set(comparableText(value).split(' ').filter((word) => word.length > 2));
}

function similarity(left: unknown, right: unknown) {
  const a = wordSet(left);
  const b = wordSet(right);
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((word) => b.has(word)).length;
  return intersection / new Set([...a, ...b]).size;
}

function kitFingerprint(kit: Partial<ContentKit> | z.infer<typeof generatedPackageSchema>['content_kit']) {
  return [kit.titulo, kit.descricao, kit.hook, kit.roteiro, kit.copy].filter(Boolean).join(' ');
}

export const CONTENT_STRATEGY_INSTRUCTIONS = [
  'TEMTREND: radar e estrategista de conteúdo TikTok Shop Brasil. Crie roteiro 15-30s gravável sozinho.',
  'EVIDÊNCIA: use só fatos do produto. Nunca invente marca, preço, vendas, comissão, desconto ou tendência.',
  'Sem evidência verificável, escreva "Sem evidência recente suficiente para classificar como tendência atual", classifique EXPERIMENTAL/INSUFICIENTE. Nunca prometa venda/viralização/cura.',
  'descricao = BRIEFING RÁPIDO: Produto, Classificação (TRENDING/RISING/SEASONAL/EVERGREEN/EXPERIMENTAL), Evidência (FORTE/MODERADA/FRACA/INSUFICIENTE), Público, Por que agora, Ângulo, Formato.',
  'titulo máx 8 palavras (capa). Cenas: 0-3s hook (dor/desejo/curiosidade, sem saudação/produto), 3-7s problema, 7-18s uso, 18-25s prova honesta, 25-30s CTA. Cada cena: tempo, visual, fala, ação/edição.',
  'roteiro inclui: "3 VARIAÇÕES DE HOOK", "VERSÃO SEM SEGUIDORES" (demonstração/teste/comparação/faceless, sem fama), "DICA DE PUBLICAÇÃO" (horário sugestão, frequência, áudio, comentário fixado, sem garantia), "3-5 VARIAÇÕES DE ROTEIRO".',
  'Prova só com demonstração visual do produto; nunca peça print de avaliação/vendas. copy máx 150 chars, 1 emoji, 1 pergunta. Exatas 5 hashtags (#publi/#tiktokshop se divulgação). CTA carrinho só condicional, nunca direct.',
  'PT-BR falado, direto, sem placeholders, só JSON.',
].join(' ');

function hasCompleteStrategy(kit: z.infer<typeof generatedPackageSchema>['content_kit']) {
  const script = comparableText(kit.roteiro);
  return [
    '3 variacoes de hook',
    'versao sem seguidores',
    'dica de publicacao',
    'variacoes de roteiro',
  ].every((section) => script.includes(section));
}

export function isContentKitNovel(
  candidate: z.infer<typeof generatedPackageSchema>['content_kit'],
  previous: Partial<ContentKit>[],
) {
  const fingerprint = kitFingerprint(candidate);
  return previous.every((kit) => (
    comparableText(candidate.titulo) !== comparableText(kit.titulo)
    && comparableText(candidate.hook) !== comparableText(kit.hook)
    && similarity(fingerprint, kitFingerprint(kit)) < 0.58
  ));
}

export function isProductNovel(
  candidate: z.infer<typeof generatedPackageSchema>['product'],
  catalog: Pick<Product, 'nome' | 'descricao' | 'categoria'>[],
) {
  const fingerprint = `${candidate.nome} ${candidate.descricao} ${candidate.categoria}`;
  return catalog.every((product) => (
    comparableText(candidate.nome) !== comparableText(product.nome)
    && similarity(fingerprint, `${product.nome} ${product.descricao ?? ''} ${product.categoria ?? ''}`) < 0.62
  ));
}

function productSeed(product: { nome: string; descricao?: string | null; categoria?: string | null }) {
  return {
    nome: product.nome.trim().slice(0, 120),
    descricao: (product.descricao?.trim() || 'Produto disponível no catálogo da TemTrend.').slice(0, AI_LIMITS.MAX_PRODUCT_DESC_CHARS),
    categoria: (product.categoria?.trim() || 'Geral').slice(0, 60),
  };
}

function truncateBriefing(value?: string) {
  const text = (value ?? '').trim().replace(/\s+/g, ' ');
  if (!text) return undefined;
  return text.length > AI_LIMITS.MAX_BRIEFING_CHARS ? text.slice(0, AI_LIMITS.MAX_BRIEFING_CHARS) : text;
}

function previousKitsCompact(previousKits: Partial<ContentKit>[]) {
  return previousKits.slice(0, AI_LIMITS.MAX_PREVIOUS_KITS).map((kit) => ({
    titulo: (kit.titulo ?? '').trim().slice(0, AI_LIMITS.MAX_PREVIOUS_KIT_CHARS),
    hook: (kit.hook ?? '').trim().slice(0, AI_LIMITS.MAX_PREVIOUS_KIT_CHARS),
    copy: typeof kit.copy === 'string' ? kit.copy.trim().slice(0, AI_LIMITS.MAX_PREVIOUS_KIT_CHARS) : undefined,
  }));
}

function productContext(product: Product) {
  // Sem URLs longas: não ajudam a criar roteiro e custam tokens.
  return {
    ...productSeed(product),
    loja: product.loja_nome?.trim().slice(0, 60) ?? null,
    preco: product.preco_texto,
    preco_min_brl: product.preco_min_brl,
    preco_max_brl: product.preco_max_brl,
    comissao_percentual: product.comissao_percentual,
    unidades_vendidas_periodo: product.unidades_vendidas_periodo,
    crescimento_vendas_percentual: product.crescimento_vendas_percentual,
    status_origem: product.status_origem,
  };
}

export async function generateContentKit(
  product: Product,
  previousKits: Partial<ContentKit>[] = [],
  creatorBriefing?: string,
): Promise<GeneratedContentKit | null> {
  if (!env.GEMINI_API_KEY || env.NODE_ENV === 'test') return null;
  const startedAt = Date.now();

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) try {
    const systemText = [
      CONTENT_STRATEGY_INSTRUCTIONS,
      'Use só dados reais do produto. Entregue todos os campos do schema, abordagem inédita vs kits anteriores, sem genéricos/placeholders.',
      'Siga o briefing do creator sem contradizer dados reais. Vídeo gravado fora da TemTrend. Hashtags com # sem espaços.',
    ].join(' ');
    const userText = JSON.stringify({
      produto: productContext(product),
      orientacoes_do_creator: truncateBriefing(creatorBriefing) || 'Sem orientação adicional; crie uma abordagem clara e prática.',
      contexto_temporal: { data_iso: new Date().toISOString(), pais: 'Brasil' },
      kits_anteriores_a_evitar: previousKitsCompact(previousKits),
      tentativa: attempt,
      nonce_criativo: crypto.randomUUID(),
    });
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: systemText
            }]
          },
          contents: [{ role: 'user', parts: [{ text: userText }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: AI_LIMITS.GENERATE_MAX_OUTPUT_TOKENS,
            responseMimeType: 'application/json',
            responseSchema: CONTENT_KIT_RESPONSE_SCHEMA,
          },
        }),
        signal: AbortSignal.timeout(AI_LIMITS.GENERATE_TIMEOUT_MS),
      },
    );

    if (!response.ok) throw new Error(`content-kit generation failed with status ${response.status}`);
    const payload = geminiResponseSchema.parse(await response.json());
    const text = payload.candidates[0]?.content.parts.map((part) => part.text).join('') ?? '';
    const generated = parseGeneratedPackage(JSON.stringify({
      product: productSeed(product),
      content_kit: JSON.parse(text).content_kit,
    }));
    if (!hasCompleteStrategy(generated.content_kit)) {
      logger.warn({ product_name: product.nome, attempt }, 'Generated content kit was incomplete; retrying');
      continue;
    }
    if (!isContentKitNovel(generated.content_kit, previousKits)) {
      logger.warn({ product_name: product.nome, attempt }, 'Generated content kit was too similar; retrying');
      continue;
    }
    const usage = usageFromResponse(payload);
    const latencyMs = Date.now() - startedAt;

    logger.info({ provider: 'gemini', model: env.GEMINI_MODEL, usage, latency_ms: latencyMs, prompt_chars: systemText.length + userText.length, prev_kits: previousKits.length }, 'Content kit generated');
    recordGenerateCall(systemText.length + userText.length, usage.total_tokens, attempt - 1);
    return { content_kit: generated.content_kit, usage, latency_ms: latencyMs };
  } catch (error) {
    logger.warn({ err: error, attempt, provider: 'gemini', model: env.GEMINI_MODEL, latency_ms: Date.now() - startedAt }, 'Content kit generation attempt failed');
  }
  return null;
}


