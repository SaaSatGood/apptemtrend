export const FALLBACK_IMAGE =
  "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20800%20600%22%3E%3Crect%20width%3D%22800%22%20height%3D%22600%22%20fill%3D%22%23f1f1f1%22%2F%3E%3Ctext%20x%3D%22400%22%20y%3D%22300%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-size%3D%2224%22%20fill%3D%22%23777%22%3EImagem%20do%20produto%3C%2Ftext%3E%3C%2Fsvg%3E";

export function displayProductName(product: { nome?: string | null } | null): string {
  const raw = String(product?.nome ?? "Produto").trim();
  if (!raw) return "Produto";
  const cut = raw.split(/\s+[–—\-–|]\s+/)[0].trim();
  const short = cut || raw;
  if (short.length <= 70) return short;
  return short.slice(0, 67).trim() + "…";
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
