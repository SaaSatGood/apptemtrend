const numberFormatter = new Intl.NumberFormat("pt-BR");
const compactFormatter = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});
const fullCurrencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatCount(value: unknown, compact = false): string {
  const parsed = Number(value ?? 0);
  return (compact ? compactFormatter : numberFormatter).format(Number.isFinite(parsed) ? parsed : 0);
}

export function formatCurrency(value: unknown): string {
  const parsed = Number(value ?? 0);
  return currencyFormatter.format(Number.isFinite(parsed) ? parsed : 0);
}

export function formatMoney(value: unknown): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "—";
  return fullCurrencyFormatter.format(parsed);
}

export function formatPercent(value: unknown): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "—";
  return `${parsed > 0 ? "+" : ""}${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(parsed)}%`;
}

export function fmtDay(iso?: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function fmtDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "2026-11-15" → "15/11" para eixos de gráfico. */
export function fmtShortDay(iso?: string | null): string {
  if (!iso) return "—";
  const [, month, day] = String(iso).slice(0, 10).split("-");
  return day && month ? `${day}/${month}` : String(iso);
}

export function metricNumber(metrics: Record<string, number | string> | null, key: string, fallback = 0): number {
  const value = Number(metrics?.[key]);
  return Number.isFinite(value) ? value : fallback;
}

export function stringValue(value: unknown): string {
  return value == null ? "" : String(value);
}

export function asNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function optional(value: string): string | undefined {
  const clean = value.trim();
  return clean || undefined;
}

export function initials(name?: string | null, fallback?: string | null): string {
  return (name || fallback || "Creator")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/** Nome de evento do funil em texto legível ("landing_view" → "Landing view"). */
export function eventLabel(name: string): string {
  const clean = name.replace(/[._]/g, " ").trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}
