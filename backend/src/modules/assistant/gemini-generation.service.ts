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

function cleanRepeatedWords(value: string) {
  return value.replace(/\b([\p{L}\p{N}]+)(?:\s+\1\b)+/giu, '$1').replace(/\s+/g, ' ').trim();
}

function completeKitTitle(title: string, productName: string) {
  const cleanedTitle = cleanRepeatedWords(title).replace(/[.;\s]+$/g, '');
  const name = cleanRepeatedWords(productName).replace(/[.;\s]+$/g, '');
  const danglingWord = /^(?:de|do|da|dos|das|em|com|para|por|e)$/i;
  const titleWords = cleanedTitle.split(/\s+/).filter(Boolean);
  const isPrefix = name.length > cleanedTitle.length
    && name.toLocaleLowerCase('pt-BR').startsWith(`${cleanedTitle.toLocaleLowerCase('pt-BR')} `);
  if (!isPrefix && !danglingWord.test(titleWords.at(-1) || '')) return cleanedTitle;
  const candidate = name || cleanedTitle;
  const words = candidate.split(/\s+/).filter(Boolean).slice(0, 8);
  while (words.length && danglingWord.test(words.at(-1)!)) words.pop();
  return words.join(' ') || cleanedTitle;
}

export function parseGeneratedPackage(text: string) {
  const generated = generatedPackageSchema.parse(JSON.parse(text));
  const vagueVisual = /^(?:problema do dia a dia(?: que o produto resolve)?|resultado final(?: após o uso)?|antes e depois|demonstração do produto|produto em close)$/i;
  const vagueSpeech = /^(?:quem passa por isso vai entender|olha a diferença no resultado|você usaria(?: isso)?\??)$/i;
  const needsSceneRepair = generated.content_kit.cenas.some((scene) => vagueVisual.test(scene.visual.trim()) || vagueSpeech.test(scene.fala.trim()));
  const fallbackScenes = needsSceneRepair ? buildFallbackKit(generated.product).cenas : null;
  return {
    ...generated,
    content_kit: {
      ...generated.content_kit,
      titulo: completeKitTitle(generated.content_kit.titulo, generated.product.nome),
      descricao: cleanRepeatedWords(generated.content_kit.descricao),
      hook: cleanRepeatedWords(generated.content_kit.hook),
      roteiro: cleanRepeatedWords(generated.content_kit.roteiro),
      cenas: generated.content_kit.cenas.map((scene, index) => ({
        ...scene,
        visual: cleanRepeatedWords(vagueVisual.test(scene.visual.trim()) ? fallbackScenes?.[index % fallbackScenes.length]?.visual || scene.visual : scene.visual),
        fala: cleanRepeatedWords(vagueSpeech.test(scene.fala.trim()) ? fallbackScenes?.[index % fallbackScenes.length]?.fala || scene.fala : index === generated.content_kit.cenas.length - 1 ? normalizeCta(scene.fala) : scene.fala),
        acao_edicao: cleanRepeatedWords(scene.acao_edicao),
      })),
      copy: cleanRepeatedWords(generated.content_kit.copy),
      hashtags: normalizeHashtags(generated.content_kit.hashtags),
      cta: normalizeCta(cleanRepeatedWords(generated.content_kit.cta)),
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
  'titulo máx 8 palavras (capa). Cenas: joias close/luz/look/presente; beleza uso; casa organização; academia rotina; eletrônicos teste. Sem placeholders ou repetição. 0-3s hook, 3-7s contexto, 7-18s uso, 18-25s prova visual, 25-30s CTA. Cada cena: tempo, visual, fala, ação/edição.',
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
  '5 VARIAÇÕES DE ROTEIRO: A) <abordagem 1> B) <abordagem 2> C) <abordagem 3> D) <abordagem 4> E) <abordagem 5>.',
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
  const productName = cleanRepeatedWords(String(product.nome || ''));
  const words = productName.split(/\s+/).filter(Boolean).slice(0, 4);
  while (words.length && /^(de|do|da|dos|das|em|com|para)$/i.test(words.at(-1)!)) words.pop();
  const short = words.join(' ') || 'este produto';
  const category = comparableText(`${product.categoria || ''} ${product.nome || ''}`);
  const kind = /joia|colar|pulseira|brinco|anel|acessorio/.test(category) ? 'joias'
    : /beleza|cosmet|maquiagem|skincare|cabelo|perfume/.test(category) ? 'beleza'
      : /casa|cozinha|organiz|decor/.test(category) ? 'casa'
        : /academia|fitness|esporte|treino/.test(category) ? 'academia'
          : /eletron|tecnolog|gadget|fone|luminaria|carregador/.test(category) ? 'eletronicos' : 'geral';
  const templates = {
    joias: {
      angle: 'Mostre os detalhes da peça e como ela aparece no look.',
      hook: 'Olha como este detalhe muda o look.',
      visuals: [`Aproxime ${short} da luz natural`, `Mostre ${short} ao lado de uma roupa básica`, `Coloque ${short} e mostre o caimento`, `Faça um close do acabamento de ${short}`, `Mostre o look completo com ${short}`],
      lines: ['O detalhe aparece melhor assim.', 'Vamos ver como combina com uma peça básica.', 'Agora olha no corpo.', 'Aqui dá para ver o acabamento de perto.', 'Confira a peça no TikTok Shop.'],
      angles: ['Close do acabamento sob luz natural', 'Uma peça com dois looks básicos', 'Ideia de presente com a peça em destaque', 'Como a peça aparece em movimento', 'Detalhes antes de escolher o acessório'],
    },
    beleza: {
      angle: 'Mostre a embalagem, o uso e o resultado visível sem prometer efeito.',
      hook: 'Quer ver este produto de perto?',
      visuals: [`Mostre a embalagem de ${short}`, `Aproxime o rótulo de ${short} da câmera`, `Demonstre o modo de usar de ${short}`, `Mostre o aspecto após a demonstração`, `Enquadre ${short} ao lado do resultado`],
      lines: ['Vou mostrar os detalhes.', 'Veja o que está na embalagem.', 'Olha como eu uso.', 'Este é o aspecto depois da demonstração.', 'Confira o produto no TikTok Shop.'],
      angles: ['Demonstração do modo de usar', 'Detalhes da embalagem', 'Rotina curta com o produto', 'Close da textura quando aplicável', 'Primeiras impressões sem promessas'],
    },
    casa: {
      angle: 'Mostre o produto no ambiente e demonstre o uso real.',
      hook: 'Olha esta ideia para usar em casa.',
      visuals: [`Mostre o espaço antes de colocar ${short}`, `Aproxime ${short} do local de uso`, `Demonstre ${short} em uso`, `Mostre o espaço com ${short} instalado`, `Enquadre o resultado e ${short}`],
      lines: ['Este é o espaço antes.', 'Agora vou colocar o produto aqui.', 'Veja como fica durante o uso.', 'Assim ficou no ambiente.', 'Confira o produto no TikTok Shop.'],
      angles: ['Antes e depois do espaço', 'Teste rápido de uso em casa', 'Detalhes do tamanho no ambiente', 'Um canto da casa em foco', 'Demonstração sem aparecer'],
    },
    academia: {
      angle: 'Mostre o produto durante um uso real de treino, sem prometer resultados.',
      hook: 'Olha este detalhe para a rotina de treino.',
      visuals: [`Mostre ${short} antes do treino`, `Faça um close de ${short} nas mãos`, `Demonstre como preparar ${short} para uso`, `Mostre ${short} durante a rotina`, `Enquadre ${short} após a demonstração`],
      lines: ['Vou mostrar o que trouxe para o treino.', 'Veja o produto de perto.', 'Assim eu preparo para usar.', 'Aqui está durante a rotina.', 'Confira o produto no TikTok Shop.'],
      angles: ['O que levo para treinar', 'Preparação antes do treino', 'Detalhes do produto em close', 'Uso real em uma rotina curta', 'Demonstração sem mostrar o rosto'],
    },
    eletronicos: {
      angle: 'Mostre os detalhes físicos e um teste simples do produto.',
      hook: 'Olha este produto funcionando de perto.',
      visuals: [`Mostre ${short} sobre uma mesa`, `Aproxime a câmera dos detalhes de ${short}`, `Mostre como ${short} é preparado para uso`, `Demonstre uma função visível de ${short}`, `Enquadre ${short} após o teste`],
      lines: ['Vou mostrar o produto de perto.', 'Veja os detalhes do acabamento.', 'Assim fica pronto para usar.', 'Agora um teste simples.', 'Confira o produto no TikTok Shop.'],
      angles: ['Teste de uma função visível', 'Detalhes do acabamento', 'Produto na mão para mostrar escala', 'Preparação para o primeiro uso', 'Demonstração em mesa'],
    },
    geral: {
      angle: 'Mostre o produto de perto e demonstre seu uso sem inventar benefícios.',
      hook: 'Olha este produto de perto.',
      visuals: [`Mostre ${short} sobre uma superfície limpa`, `Aproxime a câmera de ${short}`, `Demonstre ${short} em uso`, `Mostre o detalhe mais visível de ${short}`, `Enquadre ${short} ao final da demonstração`],
      lines: ['Vou mostrar o produto.', 'Veja os detalhes de perto.', 'Aqui está em uso.', 'Este é o resultado visual.', 'Confira o produto no TikTok Shop.'],
      angles: ['Close do produto', 'Demonstração simples de uso', 'Produto em contexto real', 'Detalhes do acabamento', 'Vídeo só com as mãos'],
    },
  } as const;
  const template = templates[kind];
  const tagBase = (product.categoria?.trim() || 'Geral').slice(0, 60).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '') || 'produto';
  const fallback = {
    titulo: completeKitTitle(productName.split(/\s+/).slice(0, 8).join(' '), productName),
    descricao: template.angle,
    formato: 'Demonstração',
    plataforma: 'TikTok',
    nivel_dificuldade: 'Fácil',
    hook: template.hook,
    roteiro: [
      `ROTEIRO PRINCIPAL: ${template.visuals.join('; ')}.`,
      `3 VARIAÇÕES DE HOOK: 1) ${template.hook} 2) Veja os detalhes deste produto. 3) Vou mostrar como fica em uso.`,
      'VERSÃO SEM SEGUIDORES: grave apenas as mãos e o produto durante a demonstração.',
      'DICA DE PUBLICAÇÃO: teste horários diferentes e fixe um comentário com pergunta.',
      `5 VARIAÇÕES DE ROTEIRO: ${template.angles.map((angle, index) => `${index + 1}) ${angle}`).join(' ')}`,
    ].join('\n'),
    cenas: template.visuals.map((visual, index) => ({ numero: index + 1, tempo: ['0–3s', '3–7s', '7–18s', '18–25s', '25–30s'][index], visual, fala: template.lines[index], acao_edicao: ['Corte rápido', 'Close estável', 'Demonstração contínua', 'Detalhe em close', 'Texto com CTA na tela'][index] })),
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


