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

// Cabeçalhos que o roteiro precisa ter (mesma ordem do esqueleto).
const SCRIPT_HEADING = /(?:ROTEIRO PRINCIPAL|(?:3\s*[–-]\s*5|[35])?\s*VARIA[ÇC][ÕO]ES DE HOOK|VERS[ÃA]O SEM SEGUIDORES|DICA DE PUBLICA[ÇC][AÃ]O|(?:3\s*[–-]\s*5|[35])?\s*VARIA[ÇC][ÕO]ES DE ROTEIRO)\s*:/gi;

/**
 * Limpa o roteiro preservando as quebras de linha. O modelo às vezes devolve
 * todas as seções na mesma linha; separar ajuda a ler no app e não muda a
 * detecção das seções (que usa os mesmos títulos).
 */
export function formatScript(value: string) {
  const withBreaks = value.replace(SCRIPT_HEADING, (match, offset: number) => (offset === 0 ? match : `\n${match}`));
  return withBreaks
    .split('\n')
    .map((line) => cleanRepeatedWords(line))
    .filter(Boolean)
    .join('\n');
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

// Direção de câmera/edição não é fala. O modelo às vezes escreve
// "(corte rápido)" ou "[texto na tela]" dentro do campo falado.
const STAGE_DIRECTION = /[([][^)\]]*\b(?:corte|close|zoom|texto|b-?roll|m[uú]sica|transi[cç][aã]o|plano|enquadr\w*|off|pausa|legenda)\b[^)\]]*[)\]]/gi;

export function stripStageDirections(value: string) {
  return value.replace(STAGE_DIRECTION, ' ').replace(/\s+/g, ' ').trim();
}

// Reparos de cena/fala vaga: comparação ancorada para não apagar conteúdo real.
const VAGUE_VISUAL = /^(?:problema do dia a dia(?: que o produto resolve)?|resultado final(?: ap[oó]s o uso)?|antes e depois|demonstra[cç][aã]o do produto|produto em close|produto em uso|close no produto|o produto|produto)\s*\.?$/i;
const VAGUE_SPEECH = /^(?:quem passa por isso vai entender|olha a diferen[cç]a no resultado|voc[eê] usaria(?: isso)?\??|vou mostrar (?:o|este) produto(?: de perto)?|veja (?:os detalhes|o produto)(?: de perto)?|aqui (?:est[aá]|esta) (?:o produto )?em uso|este [eé] o resultado(?: visual)?|é isso(?: mesmo)?)\s*\.?$/i;

export function parseGeneratedPackage(text: string) {
  const generated = generatedPackageSchema.parse(JSON.parse(text));
  const sceneCount = generated.content_kit.cenas.length;
  const needsSceneRepair = generated.content_kit.cenas.some((scene) => (
    VAGUE_VISUAL.test(scene.visual.trim()) || VAGUE_SPEECH.test(stripStageDirections(scene.fala))
  ));
  const fallbackScenes = needsSceneRepair ? buildFallbackKit(generated.product).cenas : null;
  return {
    ...generated,
    content_kit: {
      ...generated.content_kit,
      titulo: completeKitTitle(generated.content_kit.titulo, generated.product.nome),
      descricao: cleanRepeatedWords(generated.content_kit.descricao),
      hook: cleanRepeatedWords(stripStageDirections(generated.content_kit.hook)),
      roteiro: formatScript(generated.content_kit.roteiro),
      cenas: generated.content_kit.cenas.map((scene, index) => {
        const fala = stripStageDirections(scene.fala);
        const repairedFala = !fala || VAGUE_SPEECH.test(fala)
          ? fallbackScenes?.[index % fallbackScenes.length]?.fala || fala
          : index === sceneCount - 1 ? normalizeCta(fala) : fala;
        return {
          ...scene,
          visual: cleanRepeatedWords(VAGUE_VISUAL.test(scene.visual.trim()) ? fallbackScenes?.[index % fallbackScenes.length]?.visual || scene.visual : scene.visual),
          fala: cleanRepeatedWords(repairedFala),
          acao_edicao: cleanRepeatedWords(scene.acao_edicao),
        };
      }),
      copy: cleanRepeatedWords(generated.content_kit.copy),
      hashtags: normalizeHashtags(generated.content_kit.hashtags),
      cta: normalizeCta(cleanRepeatedWords(generated.content_kit.cta)),
    },
  };
}

// Palavras que aparecem em qualquer roteiro e não provam especificidade.
const GENERIC_SCRIPT_WORDS = new Set([
  'produto', 'produtos', 'coisa', 'coisas', 'melhor', 'otimo', 'otima', 'qualidade', 'praticidade',
  'pratico', 'pratica', 'simples', 'facil', 'video', 'conteudo', 'tiktok', 'shop', 'confira',
  'mostrar', 'mostra', 'mostro', 'veja', 'olha', 'aqui', 'isso', 'este', 'esta', 'esse', 'essa',
  'para', 'como', 'mais', 'muito', 'muita', 'todo', 'toda', 'sem', 'com', 'uso', 'usar', 'usando',
  'cena', 'roteiro', 'hoje', 'agora', 'depois', 'antes', 'resultado', 'detalhe', 'detalhes',
]);

/** Radicais (6 letras) das palavras que identificam ESTE produto. */
function productRadicals(product: { nome: string; descricao?: string | null; categoria?: string | null }) {
  const words = comparableText(`${product.nome} ${product.descricao ?? ''} ${product.categoria ?? ''}`)
    .split(' ')
    .filter((word) => word.length >= 4 && !GENERIC_SCRIPT_WORDS.has(word));
  return [...new Set(words.map((word) => word.slice(0, 6)))];
}

/**
 * Teste da troca: um roteiro bom cita o produto de verdade. Conta quantos
 * radicais do produto aparecem no texto falado/visualizado. Serve para pedir
 * UMA regeneração quando o modelo entrega texto que serviria para qualquer item.
 */
type KitForSpecificity = Pick<z.infer<typeof generatedPackageSchema>['content_kit'], 'hook' | 'descricao' | 'roteiro' | 'copy' | 'cenas'>;

function specificityHits(kit: KitForSpecificity, product: { nome: string; descricao?: string | null; categoria?: string | null }) {
  const radicals = productRadicals(product);
  if (!radicals.length) return { hits: 0, radicals };
  const text = [
    kit.hook, kit.descricao, kit.roteiro, kit.copy,
    ...kit.cenas.map((scene) => `${scene.visual} ${scene.fala}`),
  ].join(' ');
  const present = new Set(comparableText(text).split(' ').map((word) => word.slice(0, 6)));
  return { hits: radicals.filter((radical) => present.has(radical)).length, radicals };
}

export function productSpecificity(kit: KitForSpecificity, product: { nome: string; descricao?: string | null; categoria?: string | null }) {
  const { hits, radicals } = specificityHits(kit, product);
  return radicals.length ? hits / Math.min(radicals.length, 6) : 1;
}

export function isScriptSpecific(kit: KitForSpecificity, product: { nome: string; descricao?: string | null; categoria?: string | null }) {
  const { hits, radicals } = specificityHits(kit, product);
  if (!radicals.length) return true;
  // Um único acerto pode ser coincidência ("casa", "treino"): pede dois quando há.
  return hits >= Math.min(2, radicals.length);
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
  'descricao = 1 frase sobre o ângulo do vídeo. Sem campos Produto/Classificação/Evidência nem jargão interno. Público e vendas só se o catálogo sustentar.',
  'titulo máx 8 palavras. Cenas: joias close/luz/look/presente; beleza uso; casa organização; academia rotina; eletrônicos teste. Sem placeholders ou repetição. 0-3s hook, 3-7s contexto, 7-18s uso, 18-25s prova, 25-30s CTA. Cada cena: tempo, visual, fala, ação/edição.',
  'roteiro inclui: "3 VARIAÇÕES DE HOOK" (3 frases numeradas, diferentes); "VERSÃO SEM SEGUIDORES" (faceless/demonstração); "DICA DE PUBLICAÇÃO" (3 dicas específicas: horário a testar, comentário fixado, corte do que não prende em 2s; sem garantia); "5 VARIAÇÕES DE ROTEIRO" (5 ângulos numerados).',
  'Prova só com demonstração visual do produto; nunca peça print de avaliação/vendas. copy máx 150 chars, 1 emoji, 1 pergunta. Exatas 5 hashtags (#publi/#tiktokshop se divulgação). CTA direto no TikTok Shop, sem escassez ou estoque não verificados; nunca direct.',
  'TikTok: nunca cite botão, sticker, carrinho, recurso, interface ou link específico salvo se estiver no contexto. Prefira "conforme os recursos disponíveis no TikTok Shop".',
  'PT-BR falado, direto, sem placeholders, só JSON.',
].join(' ');

/**
 * Regras de voz humana para hook, falas e copy. Fica fora de
 * CONTENT_STRATEGY_INSTRUCTIONS (que tem teto de tamanho nos testes de custo)
 * e é enviada só na geração de kit, em todos os provedores.
 */
export const HUMAN_VOICE_INSTRUCTIONS = [
  'VOZ HUMANA: escreva como creator falando, não como anúncio.',
  'Frases curtas, de 3 a 10 palavras, com ritmo de conversa. Comece pelo concreto: o que aparece na tela agora.',
  'Proibido: "descubra", "eleve sua experiência", "solução completa", "transforme sua vida", "não perca", "imperdível", "incrível", superlativos vazios e sequência de frases com travessão.',
  'Proibido também: "não é só X, é Y", "e não é que", "aqui está o segredo", "isso muda tudo", "você não vai acreditar", "spoiler" e emoji no meio da fala.',
  'Use: "olha", "vem ver", "eu testei", "quando eu abro", "o detalhe que quase ninguém mostra", "repara nisso" — variando a abertura, sem repetir a mesma em todas as falas.',
  'Hook 0-3s: ação concreta + curiosidade real, sem clickbait e sem promessa de resultado.',
  'Fala sempre no presente e no singular. Sem narrar a edição em voz alta.',
  'Dicas e falas precisam caber naquele produto: se serviria para qualquer produto, reescreva.',
  'Antes de entregar, leia em voz alta: se soar como legenda de anúncio ou texto de IA, reescreva.',
].join(' ');


// Regras de ofício do roteiro. Ficam fora de CONTENT_STRATEGY_INSTRUCTIONS
// (que tem teto de tamanho nos testes de custo) e entram só na geração de kit.
export const SCRIPT_CRAFT_INSTRUCTIONS = [
  'OFÍCIO DO ROTEIRO:',
  'GRAVÁVEL SOZINHO: uma pessoa, celular apoiado, sem ator, drone, estúdio, cenário externo ou segunda pessoa. Se não der para gravar sozinho, troque a cena.',
  'FALA CABE NO TEMPO: 0-3s até 8 palavras; 3-7s até 12; 7-18s até 30; 18-25s até 18; 25-30s até 10. fala é só o que sai da boca; direção de câmera vai em visual/ação.',
  'DETALHE CONCRETO: cada fala e cada visual citam algo real e visível do produto (cor, material, tamanho, encaixe, textura, botão, função). Palavra vazia como "produto", "qualidade", "praticidade", "resultado final" só vale acompanhada do detalhe que prova.',
  'PROVA VISUAL: a cena mostra o que a fala afirma; se a fala promete e a cena não mostra, reescreva a fala.',
  'RITMO: comece no meio da ação, com o produto já na mão. Proibido "hoje eu vou mostrar", "nesse vídeo" e narrar a edição em voz alta.',
  'TESTE DA TROCA: se outro produto da mesma categoria puder substituir este sem mudar o texto, o roteiro está genérico: reescreva com o detalhe concreto.',
  'SEM REPETIÇÃO: cada variação avança a informação; não repita a mesma cena ou o mesmo ângulo com outra palavra.',
  'SEJA BREVE: roteiro até 1.200 caracteres, falas de 1 frase. O JSON precisa fechar completo.',
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
  'ROTEIRO PRINCIPAL: 0-3s: <fala exata do hook> | 3-7s: <contexto concreto> | 7-18s: <uso real: o que a mão faz> | 18-25s: <prova visível> | 25-30s: <CTA falado>.',
  '3 VARIAÇÕES DE HOOK: 1) <curiosidade visual> 2) <situação real da rotina> 3) <contraste antes/depois>; até 8 palavras cada.',
  'VERSÃO SEM SEGUIDORES: <enquadramento fixo em 3 passos: onde apoia o celular, o que as mãos fazem, texto exato para sobrepor>.',
  'DICA DE PUBLICAÇÃO: 1) horário: <duas janelas para testar e o que comparar> 2) comentário fixado: <pergunta específica deste produto> 3) retenção: <o que cortar nos 2 primeiros segundos>.',
  '5 VARIAÇÕES DE ROTEIRO: A) <ângulo 1> B) <ângulo 2> C) <ângulo 3> D) <ângulo 4> E) <ângulo 5>; cada uma muda o conceito, não o adjetivo.',
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
      `ROTEIRO PRINCIPAL: 0-3s: ${template.hook} | 3-7s: ${template.lines[1]} | 7-18s: ${template.lines[2]} | 18-25s: ${template.lines[3]} | 25-30s: ${template.lines[4]}`,
      `3 VARIAÇÕES DE HOOK: 1) ${template.hook} 2) Veja o detalhe deste produto de perto. 3) Gravei mostrando como fica em uso.`,
      'VERSÃO SEM SEGUIDORES: apoie o celular na mesa, grave só as mãos e o produto, sem rosto e sem falar. Deixe o texto na tela contar a história.',
      'DICA DE PUBLICAÇÃO: 1) horário: teste meio-dia e 20h e compare qual segurou mais gente 2) comentário fixado: pergunte "você usaria isso?" 3) retenção: corte tudo que não prende nos 2 primeiros segundos.',
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
  userId?: string,
): Promise<GeneratedContentKit | null> {
  if (env.NODE_ENV === 'test') return null;
  if (!env.GEMINI_API_KEY) {
    logger.error('Gemini API key missing: content-kit generation unavailable');
    return null;
  }
  const startedAt = Date.now();
  const voice = truncateVoice(creatorVoice);
  let corrections: string[] = [];

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) try {
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
    ].join(' ');
    const userText = JSON.stringify({
      produto: productContext(product),
      orientacoes_do_creator: truncateBriefing(creatorBriefing) || 'Sem orientação adicional; crie uma abordagem clara e prática.',
      ...(voice ? { voz_do_creator: voice } : {}),
      ...(corrections.length ? { correcao_obrigatoria: `Na tentativa anterior: ${corrections.join('; ')}.` } : {}),
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
    // Contabiliza toda tentativa que consumiu tokens, inclusive as que serão
    // descartadas pelos guardrails abaixo (o custo já foi cobrado pelo provedor).
    const attemptUsage = usageFromResponse(payload);
    recordGenerateCall(systemText.length + userText.length, attemptUsage.total_tokens, attempt - 1, userId);
    const text = payload.candidates[0]?.content.parts.map((part) => part.text).join('') ?? '';
    const generated = parseGeneratedPackage(JSON.stringify({
      product: productSeed(product),
      content_kit: JSON.parse(text).content_kit,
    }));
    if (!hasCompleteStrategy(generated.content_kit)) {
      corrections = [`faltaram estas seções do roteiro; inclua TODAS com estes títulos exatos: ${missingStrategySections(generated.content_kit.roteiro).join(' | ')}`];
      logger.warn({ product_name: product.nome, attempt, missing: missingStrategySections(generated.content_kit.roteiro) }, 'Generated content kit was incomplete; retrying');
      continue;
    }
    if (!isScriptSpecific(generated.content_kit, product) && attempt === 1) {
      corrections = ['o roteiro servia para qualquer produto; cite o detalhe concreto deste produto no hook e em pelo menos duas cenas'];
      logger.warn({ product_name: product.nome, attempt }, 'Generated content kit was generic; retrying once');
      continue;
    }
    if (!isContentKitNovel(generated.content_kit, previousKits)) {
      corrections = ['o kit ficou parecido com uma versão anterior; mude o ângulo, o hook e a primeira cena'];
      logger.warn({ product_name: product.nome, attempt }, 'Generated content kit was too similar; retrying');
      continue;
    }
    const usage = attemptUsage;
    const latencyMs = Date.now() - startedAt;

    logger.info({ provider: 'gemini', model: env.GEMINI_MODEL, usage, latency_ms: latencyMs, prompt_chars: systemText.length + userText.length, prev_kits: previousKits.length }, 'Content kit generated');
    return { content_kit: generated.content_kit, usage, latency_ms: latencyMs };
  } catch (error) {
    logger.warn({ err: error, attempt, provider: 'gemini', model: env.GEMINI_MODEL, latency_ms: Date.now() - startedAt }, 'Content kit generation attempt failed');
  }
  return null;
}


