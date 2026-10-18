import type { SupportStatus } from "./types";

export const SUPPORT_CATEGORY_LABEL: Record<string, string> = {
  duvida: "Dúvida",
  problema: "Problema",
  cobranca: "Cobrança",
  sugestao: "Sugestão",
  outro: "Outro",
};

export const SUPPORT_STATUS_LABEL: Record<SupportStatus, string> = {
  open: "Aguardando suporte",
  answered: "Respondido",
  resolved: "Resolvido",
  closed: "Encerrado",
};

export const SUPPORT_STATUS_CLASS: Record<SupportStatus, string> = {
  open: "is-open",
  answered: "is-answered",
  resolved: "is-resolved",
  closed: "is-closed",
};

export function fmtSupportDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
