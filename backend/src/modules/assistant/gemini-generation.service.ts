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
    hashtags: z.array(z.string().trim().min(2).max(60)).min(3).max(8),
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
  return /(?:https?:\/\/|www\.|\blink\b|\bbio\b|\bdirect\b|se quiser garantir|se (?:ele|ainda|o produto).*dispon[ií]vel|corre que acaba|[úu]ltimas unidades|estoque acaba|acaba hoje|carrinho aqui embaixo)/i.test(cta)
    ? 'Confira o produto no TikTok Shop.'
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
  'Sem evidência recente suficiente para classificar como tendência atual: trate internamente como EXPERIMENTAL/INSUFICIENTE. Não exponha esses rótulos. Nunca prometa venda/viralização/cura.',
  'descricao = 1 frase legível sobre o ângulo do vídeo. Sem campos Produto/Classificação/Evidência ou jargão interno. Cite público e vendas só quando sustentados pelo catálogo.',
  'titulo máx 8 palavras (capa). Cenas: 0-3s hook (dor/desejo/curiosidade, sem saudação/produto), 3-7s problema, 7-18s uso, 18-25s prova honesta, 25-30s CTA. Cada cena: tempo, visual, fala, ação/edição.',
  'roteiro inclui: "3 VARIAÇÕES DE HOOK" com 3 frases numeradas; "VERSÃO SEM SEGUIDORES" (demonstração/teste/faceless); "DICA DE PUBLICAÇÃO" (horário, frequência, comentário fixado, sem garantia); "5 VARIAÇÕES DE ROTEIRO" com 5 ideias numeradas.',
  'Prova só com demonstração visual do produto; nunca peça print de avaliação/vendas. copy máx 150 chars, 1 emoji, 1 pergunta. Exatas 5 hashtags (#publi/#tiktokshop se divulgação). CTA direto no TikTok Shop, sem escassez ou estoque não verificados; nunca direct.',
  'TikTok: nunca cite botão, sticker, carrinho, recurso, interface ou link específico salvo se estiver no contexto. Prefira "conforme os recursos disponíveis no TikTok Shop".',
  'PT-BR falado, direto, sem placeholders, só JSON.',
].join(' ');

function hasCompleteStrategy(kit: z.infer<typeof generatedPackageSchema>['content_kit']) {
  return missingStrategySections(kit.roteiro).length === 0;
}

export const REQUIRED_STRATEGY_SECTIONS = [
  '3 variacoes de hook',
  'versao sem seguidores',
  'dica de publicacao',
  'variacoes de roteiro',
];

// Esqueleto few-shot: o modelo copia estrutura muito melhor do que segue
// regra abstrata. Mantido fora de CONTENT_STRATEGY_INSTRUCTIONS (que tem
// teto de tamanho nos testes de custo) e enviado só na geração de kit.
export const ROTEIRO_SKELETON_INSTRUCTIONS = [
  'ESQUELETO OBRIGATÓRIO DO ROTEIRO (copie estes títulos exatamente):',
  'ROTEIRO PRINCIPAL: <sequência 0-30s>.',
  '3 VARIAÇÕES DE HOOK: 1) <curiosidade> 2) <identificação> 3) <resultado>.',
  'VERSÃO SEM SEGUIDORES: <como gravar sem audiência, ex. faceless/demonstração>.',
  'DICA DE PUBLICAÇÃO: <horário, frequência, áudio e comentário fixado, sem garantias>.',
  '3 VARIAÇÕES DE ROTEIRO: A) <abordagem 1> B) <abordagem 2> C) <abordagem 3>.',
].join(' ');

// Validação tolerante: o modelo pode frasear os títulos de outro jeito
// ("hooks alternativos", "faceless"...). Exige as 4 seções, aceita sinônimos.
const STRATEGY_SECTION_ALIASES: Array<[string, string[]]> = [
  ['3 variacoes de hook', ['3 variacoes de hook', 'variacoes de hook', 'variacao de hook', 'hooks alternativos', '3 hooks', 'ganchos alternativos']],
  ['versao sem seguidores', ['versao sem seguidores', 'sem seguidores', 'faceless', 'sem aparecer', 'sem mostrar o rosto']],
  ['dica de publicacao', ['dica de publicacao', 'dica para publicar', 'quando publicar', 'melhor horario', 'frequencia de publicacao']],
  ['variacoes de roteiro', ['variacoes de roteiro', 'variacao de roteiro', 'roteiros alternativos', 'outras abordagens', 'outros roteiros']],
];

export function missingStrategySections(roteiro: unknown): string[] {
  const script = ` ${comparableText(roteiro)} `;
  return STRATEGY_SECTION_ALIASES.filter(([, aliases]) =>
    !aliases.some((alias) => script.includes(` ${alias} `))
  ).map(([canonical]) => canonical);
}

export function isContentKitNovel(
  candidate: z.infer<typeof generatedPackageSchema>['content_kit'],
  previous: Partial<ContentKit>[],
) {
  const fingerprint = kitFingerprint(candidate);
  return previous.every((kit) => (
    comparableText(candidate.titulo) !== comparableText(kit.titulo)
    && comparableText(candidate.hook) !== comparableText(kit.hook)
    && similarity(fingerprint, kitFingerprint(kit)) < 0.62
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
  const desc = (product.descricao?.trim() || '').slice(0, AI_LIMITS.MAX_PRODUCT_DESC_CHARS);
  return {
    nome: product.nome.trim().slice(0, 120),
    descricao: desc.length >= 20 ? desc : 'Produto disponível no catálogo da TemTrend.',
    categoria: (product.categoria?.trim() || 'Geral').slice(0, 60),
  };
}

function truncateBriefing(value?: string) {
  const text = (value ?? '').trim().replace(/\s+/g, ' ');
  if (!text) return undefined;
  return text.length > AI_LIMITS.MAX_BRIEFING_CHARS ? text.slice(0, AI_LIMITS.MAX_BRIEFING_CHARS) : text;
}

function truncateVoice(value?: string | null) {
  const text = (value ?? '').trim().replace(/\s+/g, ' ');
  if (!text) return undefined;
  return text.length > 500 ? text.slice(0, 500) : text;
}

function previousKitsCompact(previousKits: Partial<ContentKit>[]) {
  return previousKits.slice(0, AI_LIMITS.MAX_PREVIOUS_KITS).map((kit) => ({
    titulo: (kit.titulo ?? '').trim().slice(0, AI_LIMITS.MAX_PREVIOUS_KIT_CHARS),
    hook: (kit.hook ?? '').trim().slice(0, AI_LIMITS.MAX_PREVIOUS_KIT_CHARS),
    copy: typeof kit.copy === 'string' ? kit.copy.trim().slice(0, AI_LIMITS.MAX_PREVIOUS_KIT_CHARS) : undefined,
  }));
}

/**
 * Roteiro base determinístico: usa SÓ nome/categoria reais do produto, sem
 * inventar preço, vendas ou tendência. Garante que salvar/gerar nunca falhe
 * mesmo com a IA fora do ar; o creator pode gerar a versão IA depois.
 */
export function buildFallbackKit(product: { nome: string; descricao?: string | null; categoria?: string | null }) {
  const words = String(product.nome || '').trim().split(/\s+/).filter(Boolean).slice(0, 5);
  const short = words.join(' ') || 'este produto';
  const tagBase = (product.categoria?.trim() || 'Geral').slice(0, 60).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '') || 'produto';
  const fallback = {
    titulo: short,
    descricao: 'Roteiro base montado com os dados do produto. Gere a versão com IA para um ângulo exclusivo.',
    formato: 'Demonstração',
    plataforma: 'TikTok',
    nivel_dificuldade: 'Fácil',
    hook: `Você precisa ver o que ${short} faz.`,
    roteiro: [
      'ROTEIRO PRINCIPAL: mostre o problema, demonstre o produto em uso e finalize com o resultado.',
      '3 VARIAÇÕES DE HOOK: 1) Você precisa ver isso. 2) Se você sofre com isso, veja esta ideia. 3) Olha essa transformação.',
      'VERSÃO SEM SEGUIDORES: grave sem aparecer, mostrando só o produto e as mãos, com teste real.',
      'DICA DE PUBLICAÇÃO: teste horários diferentes e fixe um comentário com pergunta.',
      '5 VARIAÇÕES DE ROTEIRO: 1) Antes e depois em uso real. 2) Teste rápido do produto. 3) Comparação visual do resultado. 4) Tutorial em três passos. 5) Review sincero após a demonstração.',
    ].join('\n'),
    cenas: [
      { numero: 1, tempo: '0–3s', visual: `Detalhe de ${short} em close`, fala: 'Você precisa ver isso.', acao_edicao: 'Corte rápido com zoom' },
      { numero: 2, tempo: '3–7s', visual: 'Problema do dia a dia que o produto resolve', fala: 'Quem passa por isso vai entender.', acao_edicao: 'Legenda na tela' },
      { numero: 3, tempo: '7–18s', visual: `Demonstração de ${short} em uso real`, fala: 'É só usar assim, olha como funciona.', acao_edicao: 'Timelapse da demonstração' },
      { numero: 4, tempo: '18–25s', visual: 'Resultado final após o uso', fala: 'Olha a diferença no resultado.', acao_edicao: 'Antes e depois lado a lado' },
      { numero: 5, tempo: '25–30s', visual: `chamada final com ${short}`, fala: 'Confira o produto no TikTok Shop.', acao_edicao: 'Texto com CTA na tela' },
    ],
    copy: `Você já conhecia ${short.slice(0, 60)}? Comenta aqui 👇`,
    cta: 'Confira o produto no TikTok Shop.',
    hashtags: ['#achadinhos', '#tiktokshop', '#publi', `#${tagBase}`, '#dica'],
    audio_sugerido: 'Áudio em alta no TikTok, volume baixo.',
    duracao_seg: 25,
  };
  const parsed = generatedPackageSchema.parse({ product: productSeed(product), content_kit: fallback });
  return parsed.content_kit;
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
  creatorVoice?: string | null,
): Promise<GeneratedContentKit | null> {
  if (env.NODE_ENV === 'test') return null;
  if (!env.GEMINI_API_KEY) {
    logger.error('Gemini API key missing: content-kit generation unavailable');
    return null;
  }
  const startedAt = Date.now();
  const voice = truncateVoice(creatorVoice);
  let missingSections: string[] = [];

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) try {
    const systemText = [
      CONTENT_STRATEGY_INSTRUCTIONS,
      'Use só dados reais do produto. Entregue todos os campos do schema, abordagem inédita vs kits anteriores, sem genéricos/placeholders.',
      'Siga o briefing do creator sem contradizer dados reais. Vídeo gravado fora da TemTrend. Hashtags com # sem espaços.',
      voice
        ? 'Escreva hook, falas e copy no jeito de falar do creator (amostra abaixo); o briefing pontual prevalece em conflito. Nunca mude dados reais para combinar com a amostra.'
        : 'Sem amostra de voz; use um tom direto e prático.',
      ROTEIRO_SKELETON_INSTRUCTIONS,
    ].join(' ');
    const userText = JSON.stringify({
      produto: productContext(product),
      orientacoes_do_creator: truncateBriefing(creatorBriefing) || 'Sem orientação adicional; crie uma abordagem clara e prática.',
      ...(voice ? { voz_do_creator: voice } : {}),
      ...(missingSections.length ? { correcao_obrigatoria: `Na tentativa anterior faltaram estas seções do roteiro; inclua TODAS com estes títulos exatos: ${missingSections.join(' | ')}` } : {}),
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
      missingSections = missingStrategySections(generated.content_kit.roteiro);
      logger.warn({ product_name: product.nome, attempt, missing: missingSections }, 'Generated content kit was incomplete; retrying');
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


