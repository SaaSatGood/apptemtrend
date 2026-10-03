import { z } from 'zod';
import { env } from '../../config/env.js';
import { AI_LIMITS } from '../../config/constants.js';
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
  'Você é a TEMTREND, um radar de oportunidades e estrategista de conteúdo para TikTok Shop Brasil.',
  'Transforme dados reais do produto em conteúdo completo, específico e pronto para uma pessoa gravar sozinha em 15 a 30 segundos.',
  'Antes de criar, avalie demanda, demonstração visual, problema resolvido, desejo, entendimento em cinco segundos, sazonalidade, competição, repetibilidade e acessibilidade para creators iniciantes.',
  'EVIDÊNCIA: nunca invente marca, preço, vendas, avaliações, comissão, desconto, crescimento, disponibilidade ou tendência. Use somente fatos presentes no produto ou no contexto recebido.',
  'Quando não houver evidência atual verificável, escreva literalmente "Sem evidência recente suficiente para classificar como tendência atual" e classifique como EXPERIMENTAL, com evidência INSUFICIENTE.',
  'Nunca apresente hipótese ou sugestão criativa como fato. Nunca prometa venda, viralização, cura ou resultado garantido.',
  'Na descricao, entregue um BRIEFING RÁPIDO com Produto, Classificação (TRENDING, RISING, SEASONAL, EVERGREEN ou EXPERIMENTAL), Evidência (FORTE, MODERADA, FRACA ou INSUFICIENTE), Público, Por que agora, Ângulo e Formato.',
  'O titulo deve ter no máximo oito palavras e funcionar como capa do vídeo.',
  'As cenas devem cobrir: 0–3s hook sem abrir pelo produto; 3–7s problema ou identificação; 7–18s produto em uso; 18–25s prova ou resultado honesto; 25–30s CTA.',
  'Cada cena deve informar tempo, visual, fala e ação/edição. O hook precisa começar pela dor, desejo, curiosidade ou resultado, nunca por uma saudação ou apresentação do produto.',
  'No roteiro, além do texto principal, inclua seções claramente rotuladas: "3 VARIAÇÕES DE HOOK" (curiosidade, identificação e resultado), "VERSÃO SEM SEGUIDORES", "DICA DE PUBLICAÇÃO" e "3–5 VARIAÇÕES DE ROTEIRO".',
  'A versão sem seguidores não pode depender de fama, comunidade ou autoridade. Prefira demonstração, teste, comparação, review sincero, faceless, ASMR, tutorial ou antes/depois realista.',
  'Nunca peça para mostrar print de avaliação, contador de vendas ou comentário se esse material real não foi fornecido. Nesse caso, use prova visual demonstrável do próprio produto.',
  'A copy deve ter no máximo 150 caracteres, exatamente um emoji e uma pergunta natural que incentive comentário.',
  'Entregue exatamente cinco hashtags relevantes. Use #publi e #tiktokshop quando o conteúdo for divulgação de produto.',
  'O CTA pode mencionar o carrinho do vídeo apenas de forma condicional, sem inventar disponibilidade. Nunca afirme que enviará link por direct.',
  'Inclua em DICA DE PUBLICAÇÃO: faixa de horário como sugestão, frequência, tipo de áudio e primeiro comentário fixado. Não trate horário ou métrica como garantia.',
  'Crie de três a cinco variações realmente diferentes para o mesmo produto, alternando ângulos como antes/depois, teste, lista, POV, comparação, review, tutorial ou faceless.',
  'Escreva em português falado do Brasil, direto e natural. Não use placeholders e não inclua explicações fora do JSON.',
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
    nome: product.nome,
    descricao: (product.descricao || 'Produto disponível no catálogo da TemTrend.').slice(0, 1200),
    categoria: product.categoria || 'Geral',
  };
}

function productContext(product: Product) {
  return {
    ...productSeed(product),
    id_produto: product.produto_externo_id,
    loja: product.loja_nome,
    preco: product.preco_texto,
    preco_min_brl: product.preco_min_brl,
    preco_max_brl: product.preco_max_brl,
    pais_regiao: product.pais_regiao,
    comissao_percentual: product.comissao_percentual,
    unidades_vendidas_periodo: product.unidades_vendidas_periodo,
    crescimento_vendas_percentual: product.crescimento_vendas_percentual,
    unidades_vendidas_total: product.unidades_vendidas_total,
    receita_periodo_brl: product.receita_periodo_brl,
    receita_total_brl: product.receita_total_brl,
    link_tiktok_shop: product.tiktok_shop_url,
    link_fastmoss: product.fastmoss_produto_url,
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
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: [
                CONTENT_STRATEGY_INSTRUCTIONS,
                'Utilize somente as características reais fornecidas para o produto do catálogo.',
                'Entregue titulo, descricao, formato, plataforma, nivel_dificuldade, hook, roteiro, cenas com tempo, visual, fala e acao_edicao, copy, CTA, cinco hashtags, audio_sugerido e duracao_seg.',
                'Crie uma abordagem genuinamente inédita. Não copie, parafraseie nem recombine superficialmente nenhum Content Kit anterior fornecido.',
                'Varie gancho, conceito, estrutura narrativa, cenas, copy e CTA. O resultado deve ser utilizável por completo, sem campos genéricos ou placeholders.',
                'Siga as orientações criativas do creator sobre tom, duração, formato, ritmo e modo de gravação, desde que não contradigam os dados reais do produto.',
                'O vídeo é gravado fora da TemTrend. Hashtags devem começar com # e não conter espaços.',
              ].join(' ')
            }]
          },
          contents: [{ role: 'user', parts: [{ text: JSON.stringify({
            produto: productContext(product),
            orientacoes_do_creator: creatorBriefing?.trim() || 'Sem orientação adicional; crie uma abordagem clara e prática.',
            contexto_temporal: { data_iso: new Date().toISOString(), pais: 'Brasil' },
            kits_anteriores_a_evitar: previousKits.slice(0, 20).map((kit) => ({
              titulo: kit.titulo, hook: kit.hook, roteiro: kit.roteiro, copy: kit.copy,
            })),
            tentativa: attempt,
            nonce_criativo: crypto.randomUUID(),
          }) }] }],
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 3500,
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

    logger.info({ provider: 'gemini', model: env.GEMINI_MODEL, usage, latency_ms: latencyMs }, 'Content kit generated');
    return { content_kit: generated.content_kit, usage, latency_ms: latencyMs };
  } catch (error) {
    logger.warn({ err: error, attempt, provider: 'gemini', model: env.GEMINI_MODEL, latency_ms: Date.now() - startedAt }, 'Content kit generation attempt failed');
  }
  return null;
}


