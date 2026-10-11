import { displayProductName } from "@/lib/format";
import type { ContentKit, Product } from "@/lib/types";

const DIRECT_CTA = "Confira o produto no TikTok Shop.";

function clean(value: string) {
  return value.replace(/\s+/g, " ").replace(/[.;\s]+$/g, "").trim();
}

function fieldsFrom(description: string) {
  const fields = new Map<string, string>();
  const labels = [...description.matchAll(/(?:^|[.;]\s*|\n\s*)(Produto|Classifica[çc][ãa]o|Evid[êe]ncia|P[úu]blico|Por que agora|[ÂA]ngulo|Formato)\s*:/gi)];
  labels.forEach((match, index) => {
    const key = match[1].normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < labels.length ? labels[index + 1].index : description.length;
    const value = clean(description.slice(start, end));
    if (value) fields.set(key, value);
  });
  return fields;
}

export function kitContext(kit: ContentKit, product: Product) {
  const description = kit.descricao?.trim() || "";
  const fields = fieldsFrom(description);
  const angle = fields.get("angulo");
  const plainDescription = !fields.size ? clean(description) : "";
  const summary = angle
    ? `${angle[0].toLocaleUpperCase("pt-BR")}${angle.slice(1)}.`
    : plainDescription && !/\b(classifica[çc][ãa]o|evid[êe]ncia)\s*:/i.test(plainDescription)
      ? `${plainDescription.slice(0, 155)}${plainDescription.length > 155 ? "…" : "."}`
      : `Um plano curto para mostrar ${displayProductName(product)} em uso.`;
  const audience = fields.get("publico") || null;
  const sales = product.unidades_vendidas_periodo ?? product.unidades_vendidas_total;
  return {
    summary,
    audience,
    sales: sales != null ? `${sales.toLocaleString("pt-BR")} vendas ${product.unidades_vendidas_periodo != null ? "no período" : "no total"}` : null,
  };
}

export function directCta(value?: string | null) {
  if (!value?.trim()) return DIRECT_CTA;
  const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/se quiser garantir|se (?:ele|ainda|o produto).*disponiv|corre que acaba|ultimas unidades|estoque acaba|acaba hoje|carrinho aqui embaixo|link da bio|\bdirect\b|https?:\/\/|www\./.test(normalized)) return DIRECT_CTA;
  return value.trim();
}

export function finalSceneLine(value: string, isLast: boolean) {
  return isLast ? directCta(value) : value;
}

type Strategy = { main: string | null; faceless: string | null; publishing: string | null; hookOptions: string[]; scriptOptions: string[] };

function variants(value: string, shortIdeas = false) {
  const markers = [...value.matchAll(/(?:^|\s)(?:[1-5]|[A-E])[).:-]\s*/gi)];
  let items: string[];
  if (markers.length >= 2) {
    items = markers.map((marker, index) => clean(value.slice((marker.index ?? 0) + marker[0].length, index + 1 < markers.length ? markers[index + 1].index : value.length)));
  } else {
    const quoted = [...value.matchAll(/[“"]([^”"]+)[”"]/g)].map((match) => clean(match[1]));
    items = quoted.length >= 2 ? quoted : shortIdeas ? value.split(/\s*[,;\n]\s*/).map(clean) : [];
    if (shortIdeas && items.length < 5 && items.length > 1) {
      const last = items.pop() || "";
      const lastPair = last.split(/\s+e\s+/i);
      items.push(...(lastPair.length === 2 ? lastPair : [last]));
    }
  }
  return [...new Set(items.filter((item) => item.length >= (shortIdeas ? 3 : 12)))].slice(0, 5);
}

export function strategyFrom(roteiro?: string | null): Strategy {
  const empty: Strategy = { main: null, faceless: null, publishing: null, hookOptions: [], scriptOptions: [] };
  if (!roteiro?.trim()) return empty;
  const headings = [...roteiro.matchAll(/(?:ROTEIRO PRINCIPAL|(?:3\s*[–-]\s*5|[35])?\s*VARIA[ÇC][ÕO]ES DE HOOK|VERS[ÃA]O SEM SEGUIDORES|DICA DE PUBLICA[ÇC][ÃA]O|(?:3\s*[–-]\s*5|[35])?\s*VARIA[ÇC][ÕO]ES DE ROTEIRO)\s*:/gi)];
  if (!headings.length) return { ...empty, main: roteiro.trim() };
  const sections = new Map<string, string>();
  headings.forEach((match, index) => {
    const heading = match[0].normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < headings.length ? headings[index + 1].index : roteiro.length;
    sections.set(heading, clean(roteiro.slice(start, end)));
  });
  const section = (part: string) => [...sections.entries()].find(([key]) => key.includes(part))?.[1] || "";
  return {
    main: section("roteiro principal") || null,
    faceless: section("versao sem seguidores") || null,
    publishing: section("dica de publicacao") || null,
    hookOptions: variants(section("variacoes de hook")),
    scriptOptions: variants(section("variacoes de roteiro"), true),
  };
}
