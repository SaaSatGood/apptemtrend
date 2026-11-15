/**
 * Base de conhecimento FECHADA do assistente de suporte.
 *
 * Regra do produto: a IA só responde sobre a TemTrend. Nada de conhecimento
 * geral, notícia, receita, saúde, direito, código, outro app etc. Tudo que a IA
 * pode afirmar sobre a plataforma está listado aqui (ou vem no contexto do
 * creator), para ela não precisar — nem poder — inventar.
 *
 * Mantenha estes fatos sincronizados com `backend/src/modules/billing/plans.ts`,
 * `backend/src/config/constants.ts` e `docs/relatorio-precificacao.md`.
 */
export const PLATFORM_FACTS = [
  'A TemTrend acha produtos reais do TikTok Shop e monta o plano de gravação: hook, cenas, roteiro, legenda, CTA, hashtags, áudio e duração.',
  'Jornada: Descobrir → salvar produto → gerar roteiro completo → guia de gravação por etapas → Minha produção (salvo → em produção → gravado → publicado).',
  'Plano Grátis: acesso inicial à plataforma dentro dos limites definidos na conta, sem renovação automática. Os limites e recursos podem ser ajustados.',
  'Plano Pro: R$ 49,90 por mês ou R$ 499 por ano. Buscas e roteiros ilimitados com uso justo interno contra abuso, variações liberadas (espera de 30s entre versões), voz personalizada e produção sem teto.',
  'Não existe teste grátis (trial) nem compra de roteiro avulso.',
  'A TemTrend não publica o vídeo, não edita vídeo, não garante vendas nem viralização e não mostra views ou faturamento do creator.',
  'Voz personalizada: até 500 caracteres no perfil, aplicada a todos os roteiros gerados.',
  'Planejador semanal: monta até 7 dias de conteúdo, um roteiro por dia, sem publicar automaticamente.',
  'Calendário editorial: organiza data e status de cada conteúdo, também sem publicar automaticamente.',
  'Cancelamento: na área da conta. O plano continua valendo até o fim do período pago e depois volta ao Grátis.',
  'Assistente de suporte: até 40 perguntas por dia por creator.',
  'Cobrança, reembolso, bloqueio de conta, bug ou pedido fora do que está aqui: encaminhe para o time humano em "Nova conversa".',
] as const;

/** Recusa padrão para qualquer assunto fora da TemTrend. */
export const EXTERNAL_REFUSAL = [
  'Eu só consigo ajudar com a TemTrend: achar produto, montar roteiro e publicar seu vídeo.',
  'Essa pergunta foge do que eu sei, então prefiro não chutar e te passar informação errada.',
  'Quer que eu te ajude com um produto ou com o seu próximo roteiro?',
].join(' ');

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Âncoras da plataforma. Se a mensagem cita algo da TemTrend, ela passa para o
 * modelo (que decide com contexto), mesmo que tenha palavras "externas".
 */
const PLATFORM_ANCHOR = /\b(temtrend|plataforma|aplicativo|app|kit|roteiro|script|hook|hashtag|legenda|cena|grav\w*|public\w*|tiktok|shop|produto|catalogo|plano|assinatura|cobranca|reembolso|conta|perfil|suporte|busca|buscar|onboarding|producao|calendario|voz|comissao|vend\w*|creator)\b/;

/** Temas claramente externos: recusa sem gastar chamada de IA. */
const EXTERNAL_TOPICS: Array<{ label: string; pattern: RegExp }> = [
  {
    label: 'notícias e política',
    pattern: /\b(noticia|noticias|jornal|manchete|eleicao|eleicoes|presidente|politica|guerra|inflacao|dolar|bitcoin|cripto|bolsa de valores|ibovespa)\b/,
  },
  {
    label: 'clima',
    pattern: /\b(clima|previsao do tempo|vai chover|temperatura de hoje|tempo hoje)\b/,
  },
  {
    label: 'esporte e entretenimento',
    pattern: /\b(futebol|jogo do|placar|campeonato|celebridade|novela|filme|serie da netflix|bbb|big brother)\b/,
  },
  {
    label: 'receitas',
    pattern: /\b(receita de (bolo|pao|comida|doce)|como fazer (bolo|pao|pizza|massa))\b/,
  },
  {
    label: 'programação e matemática',
    pattern: /\b(python|javascript|typescript|java|c\+\+|html|css|sql|escreva (um )?codigo|programacao|equacao|derivada|integral|calcule)\b/,
  },
  {
    label: 'saúde, direito e dinheiro pessoal',
    pattern: /\b(medico|diagnostico|remedio|dor de cabeca|sintoma|advogado|processo judicial|investimento|acoes|tesouro direto|imposto de renda|financiamento)\b/,
  },
  {
    label: 'tradução e dever escolar',
    pattern: /\b(traduza|traducao|traduzir|resuma (o|este|esse) (texto|artigo|livro)|trabalho de escola|tese|redacao|monografia)\b/,
  },
  {
    label: 'outros aplicativos e assuntos gerais',
    pattern: /\b(instagram|facebook|whatsapp|youtube|kwai|shopee|mercado livre|amazon|shein)\b.*\b(como|vender|ganhar|seguidores|conta)\b/,
  },
];

/**
 * Detecta, sem IA, perguntas claramente fora do escopo da TemTrend.
 * Retorna o rótulo do tema externo (para log) ou null quando a mensagem pode
 * seguir para o modelo.
 */
export function detectExternalSupportQuestion(message: string): string | null {
  const text = normalize(message);
  if (text.length < 4) return null;
  if (PLATFORM_ANCHOR.test(text)) return null;
  const hit = EXTERNAL_TOPICS.find((topic) => topic.pattern.test(text));
  return hit?.label ?? null;
}
