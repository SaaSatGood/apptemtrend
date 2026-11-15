const FILTER_LABELS: Record<string, string> = {
  "Quero produtos com preço de até 50 reais": "Até R$ 50",
  "Quero produtos com preço de até 100 reais": "Até R$ 100",
  "Quero vender produtos para casa": "Casa",
  "Quero vender produtos de beleza": "Beleza",
};

const GREETING_ONLY = /^(?:oi+|ol[aá]|bom dia|boa tarde|boa noite|hey|e a[ií]|tudo bem)[\s!.,]*$/i;
const GREETING_PREFIX = /^(?:oi+|ol[aá]|bom dia|boa tarde|boa noite|hey|e a[ií]|tudo bem)[\s!.,;:-]+/i;
const GENERIC_TITLE = /^(?:sua busca|nova busca|nova conversa|conversa sem t[íi]tulo|produto|produtos|quero vender prod.*)$/i;

function conversationDate(iso?: string | null): string {
  const date = iso ? new Date(iso) : new Date();
  const safe = Number.isNaN(date.getTime()) ? new Date() : date;
  return `Conversa de ${new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(safe)}`;
}

function compactQuery(query: string): string {
  const trimmed = query.trim().replace(/\s+/g, " ");
  const known = FILTER_LABELS[trimmed];
  if (known) return known;

  let rest = trimmed;
  let matched = false;
  let priceLabel = "";

  const price = rest.match(/\s*(?:com\s+)?pre[çc]o\s+de\s+at[ée]\s+R?\$?\s*(\d+)(?:\s+reais)?\s*$/i);
  if (price) {
    priceLabel = `até R$ ${price[1]}`;
    rest = rest.slice(0, price.index).trim();
    matched = true;
  }

  const niche = rest.match(/^quero vender produtos (?:para|de)\s+(.+)$/i);
  if (niche) {
    rest = niche[1].trim();
    matched = true;
  }

  if (!matched) return trimmed;
  const lead = rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : "";
  if (lead && priceLabel) return `${lead} · ${priceLabel}`;
  return lead || (priceLabel ? priceLabel.charAt(0).toUpperCase() + priceLabel.slice(1) : trimmed);
}

function shortPhrase(value: string, maxLength = 48): string {
  const words = value.split(" ").filter(Boolean);
  let out = "";
  for (const word of words) {
    const next = out ? `${out} ${word}` : word;
    if (next.length > maxLength && out) break;
    out = next;
  }
  return (out || words[0] || "").replace(/[,;:.\-–—]+$/g, "").trim();
}

/** Título curto e legível para a conversa recém-criada. */
export function sessionTitleFromQuery(query: string, createdAt?: string | null): string {
  let text = String(query ?? "").trim().replace(/\s+/g, " ");
  text = text.replace(GREETING_PREFIX, "").trim();
  if (!text || text.length < 3 || GREETING_ONLY.test(text)) return conversationDate(createdAt);

  text = compactQuery(text);
  text = text
    .replace(/^(?:quero|preciso|procuro|busco|me\s+mostre|me\s+sugira|sugira)\s+(?:vender\s+)?(?:produtos?\s+)?(?:para|de|sobre)?\s*/i, "")
    .replace(/\s+(?:para\s+vender|para\s+come[cç]ar|no\s+tiktok\s+shop)\s*$/i, "")
    .trim();

  if (!text || GENERIC_TITLE.test(text) || text.length < 3) return conversationDate(createdAt);
  const result = shortPhrase(text.charAt(0).toUpperCase() + text.slice(1));
  return result || conversationDate(createdAt);
}

/**
 * Corrige títulos antigos salvos como saudação ou pergunta truncada. Títulos
 * já personalizados pelo creator passam intactos; a pontuação final sai, mas
 * a pergunta continua sendo um título válido.
 */
export function displaySessionTitle(title: string | null | undefined, createdAt?: string | null): string {
  const text = String(title ?? "").trim().replace(/\s+/g, " ");
  const cleaned = text.replace(/[?!.,;:]+$/g, "").trim();
  const placeholder = !cleaned
    || cleaned.length < 4
    || GREETING_ONLY.test(cleaned)
    || GENERIC_TITLE.test(cleaned)
    || /^conversa de \d{2}\/\d{2}$/i.test(cleaned);
  if (placeholder) return conversationDate(createdAt);
  return cleaned;
}
