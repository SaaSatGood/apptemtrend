export const FALLBACK_IMAGE =
  "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20800%20600%22%3E%3Crect%20width%3D%22800%22%20height%3D%22600%22%20fill%3D%22%23f1f1f1%22%2F%3E%3Ctext%20x%3D%22400%22%20y%3D%22300%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-size%3D%2224%22%20fill%3D%22%23777%22%3EImagem%20do%20produto%3C%2Ftext%3E%3C%2Fsvg%3E";

const PRODUCT_CONNECTORS = new Set([
  "a", "as", "o", "os", "de", "da", "das", "do", "dos", "e", "em", "com", "para", "por",
  "no", "na", "nos", "nas", "ao", "aos", "à", "às",
]);

// Termos de anúncio que não ajudam a identificar o produto.
const MARKETING_NOISE = /(?:\b(?:frete|envio|entrega)\s+(?:gr[aá]tis|r[aá]pido|imediato|expresso)\b|\bpronta?\s+entrega\b|\bcompre\s+(?:agora|j[aá])\b|\baproveite?\s+(?:agora|j[aá]|a\s+oferta)\b|\b(?:oferta|promo[cç][aã]o|liquida[cç][aã]o|queima\s+de\s+estoque)\b|\b(?:mais\s+vendido|best\s*seller|viral|hot\s*sale|tend[eê]ncia)\b|\b(?:lacrado|importado|original)\b|\btiktok\s*shop\b|\bshopee\b|\bmercado\s+livre\b)/giu;

function stripProductNoise(value: string): string {
  return value
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, " ")
    .replace(/\[[^\]]*\]|\([^)]*\)/g, " ")
    .replace(/\b(?:cod|c[oó]digo|ref|sku)\s*[:#]?\s*[a-z0-9-]{4,}\b/giu, " ")
    .replace(/\b[a-z]{0,3}\d{5,}[a-z0-9-]*\b/giu, " ")
    .replace(MARKETING_NOISE, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function candidateScore(value: string): number {
  const words = value.split(" ").filter((word) => /\p{L}/u.test(word) && word.length > 2);
  let score = words.length * 2;
  if (value.length <= 46) score += 2;
  if (/^(?:kit|conjunto|combo|pacote)\b/i.test(value)) score += 1;
  if (value.length > 60) score -= (value.length - 60) / 10;
  return score;
}

function clampProductName(value: string, maxLength: number): string {
  let text = value
    .replace(/\s+(?:com\s+)?\d+(?:[.,]\d+)?\s*(?:ml|l|g|kg|mg|cm|mm|m|w|v|pcs|pe[cç]as?|unidades?|un)\b.*$/iu, "")
    .replace(/[,;:.\-–—]+$/g, "")
    .trim();
  text = text.replace(/\b([\p{L}\p{N}]+)(?:\s+\1\b)+/giu, "$1").replace(/\s+/g, " ").trim();
  const words = text.split(" ").filter(Boolean);
  while (words.length && PRODUCT_CONNECTORS.has(words.at(-1)!.toLocaleLowerCase("pt-BR"))) words.pop();
  let out = "";
  for (const word of words) {
    const next = out ? `${out} ${word}` : word;
    if (next.length > maxLength && out) break;
    out = next;
  }
  return (out || text.slice(0, maxLength)).trim();
}

function titleizeProductName(value: string): string {
  const letters = value.replace(/[^\p{L}]/gu, "");
  const isAllUpper = Boolean(letters) && letters === letters.toLocaleUpperCase("pt-BR");
  const isAllLower = Boolean(letters) && letters === letters.toLocaleLowerCase("pt-BR");
  // Nomes já bem capitalizados (iPhone, TikTok, "Organizador de cozinha") passam intactos.
  if (!isAllUpper && !isAllLower) return value;
  const acronyms = new Set(["led", "usb", "rgb", "3d", "4k", "hd", "uhd", "xl", "xxl", "pcs", "un"]);
  return value
    .split(" ")
    .filter(Boolean)
    .map((word, index) => {
      const lower = word.toLocaleLowerCase("pt-BR");
      if (index > 0 && PRODUCT_CONNECTORS.has(lower)) return lower;
      if (acronyms.has(lower)) return lower.toUpperCase();
      return lower.charAt(0).toLocaleUpperCase("pt-BR") + lower.slice(1);
    })
    .join(" ");
}

function cleanProductName(rawValue: string, maxLength: number): string {
  const raw = stripProductNoise(String(rawValue ?? ""));
  if (!raw) return "Produto";
  const candidates = raw
    .split(/\s*[|/•·;]\s*|\s+[–—-]\s+|,(?=\s)|\n+/u)
    .map((part) => stripProductNoise(part))
    .filter(Boolean);
  const best = (candidates.length ? candidates : [raw]).reduce((winner, candidate) => (
    candidateScore(candidate) > candidateScore(winner) ? candidate : winner
  ));
  const cleaned = clampProductName(best || raw, maxLength);
  if (!cleaned || /^(?:produto|item|novo|nova|oferta|promo[cç][aã]o)$/i.test(cleaned)) return "Produto";
  return titleizeProductName(cleaned);
}

export function displayProductName(product: { nome?: string | null } | null): string {
  return cleanProductName(String(product?.nome ?? "Produto"), 58);
}

export function fullProductName(product: { nome?: string | null } | null): string {
  return String(product?.nome ?? "Produto").trim() || "Produto";
}

export function formatUpdated(value: string | null | undefined): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function validTikTokUrl(value: string): boolean {
  if (!value) return true;
  try {
    const host = new URL(value).hostname.toLowerCase();
    return (
      host === "tiktok.com" ||
      host.endsWith(".tiktok.com") ||
      host === "vm.tiktok.com" ||
      host === "vt.tiktok.com" ||
      host === "m.tiktok.com" ||
      host === "www.tiktok.com"
    );
  } catch {
    return false;
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text || "");
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text || "";
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      return true;
    } catch {
      return false;
    }
  }
}

export type Scene = {
  numero?: number;
  tempo?: string;
  time?: string;
  visual?: string;
  mostre?: string;
  fala?: string;
  fale?: string;
  acao_edicao?: string;
};

export function normalizeScenes(value: unknown): Array<Scene | string> {
  if (!value) return [];
  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return [];
    try {
      return normalizeScenes(JSON.parse(text));
    } catch {
      return text
        .split(/\n{2,}|\n(?=cena\s*\d+)/i)
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }
  if (Array.isArray(value)) return value.flatMap((item) => normalizeScenes(item));
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.cenas)) return normalizeScenes(obj.cenas);
    const sceneKeys = [
      "mostre", "visual", "acao", "ação", "fale", "fala", "texto",
      "roteiro", "descricao", "descrição", "cena", "title", "titulo",
    ];
    if (sceneKeys.some((key) => obj[key] != null)) return [obj as Scene];
    return Object.values(obj).flatMap((item) => normalizeScenes(item));
  }
  return [String(value)];
}

/** Nome curto para listas e cabeçalhos: sem a descrição comprida do marketplace. */
export function shortProductName(raw: string): string {
  return cleanProductName(String(raw ?? ""), 42);
}
