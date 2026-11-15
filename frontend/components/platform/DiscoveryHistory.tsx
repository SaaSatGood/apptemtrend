"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";
import type { DiscoverySearchSummary } from "@/lib/types";
import Modal from "./Modal";

function relativeDate(iso: string): string {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return "";
  const minutes = Math.max(0, Math.round((Date.now() - time) / 60000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days} dias`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function resultLabel(count: number): string {
  return `${count} ${count === 1 ? "produto" : "produtos"}`;
}

const FILTER_LABELS: Record<string, string> = {
  "Quero produtos com preço de até 50 reais": "Até R$ 50",
  "Quero produtos com preço de até 100 reais": "Até R$ 100",
  "Quero vender produtos para casa": "Casa",
  "Quero vender produtos de beleza": "Beleza",
};

/**
 * Rótulo curto para os chips de busca recente: mostra os filtros aplicados
 * em vez do começo repetido da frase. Texto livre permanece intacto.
 */
export function compactSearchQuery(query: string): string {
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
  if (lead) return lead;
  return priceLabel ? priceLabel.charAt(0).toUpperCase() + priceLabel.slice(1) : trimmed;
}

/** Faixa compacta de buscas recentes logo abaixo do herói do Descobrir. */
export function RecentSearches({
  items,
  busyId,
  onOpen,
  onShowAll,
}: {
  items: DiscoverySearchSummary[];
  busyId: string | null;
  onOpen: (id: string) => void;
  onShowAll: () => void;
}) {
  if (!items.length) return null;
  return (
    <div className="discovery-history" aria-label="Buscas recentes">
      <span className="discovery-history-label">
        <Icon name="clock" size={14} strokeWidth={1.9} />
        Buscas recentes
      </span>
      <div className="discovery-history-list">
        {items.slice(0, 4).map((item) => (
          <button
            key={item.id}
            type="button"
            className="discovery-history-item"
            onClick={() => onOpen(item.id)}
            disabled={Boolean(busyId)}
            aria-busy={busyId === item.id}
            aria-label={`Reabrir busca: ${item.query}`}
            title={item.query}
          >
            <span className="discovery-history-query">{compactSearchQuery(item.query)}</span>
            <small>{resultLabel(item.result_count)}</small>
          </button>
        ))}
      </div>
      <button type="button" className="discovery-history-all" onClick={onShowAll}>
        Ver todas
      </button>
    </div>
  );
}

/** Pop-up com todo o histórico do Descobrir (abrir, remover e limpar). */
export function SearchHistoryDialog({
  items,
  busyId,
  clearing,
  error,
  onClose,
  onOpen,
  onDelete,
  onClear,
}: {
  items: DiscoverySearchSummary[];
  busyId: string | null;
  clearing: boolean;
  error: string;
  onClose: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}) {
  const [confirmClear, setConfirmClear] = useState(false);
  const busy = Boolean(busyId) || clearing;

  return (
    <Modal titleId="search-history-title" onClose={onClose} busy={busy} className="search-history-dialog">
      <div className="search-history-head">
        <p className="eyebrow">No seu Descobrir</p>
        <h2 id="search-history-title">Buscas recentes</h2>
        <p className="muted">Abra de novo para ver os mesmos produtos, sem gastar uma nova busca.</p>
      </div>
      {error && <p className="search-history-error" role="alert">{error}</p>}
      {items.length ? (
        <ul className="search-history-list">
          {items.map((item) => (
            <li key={item.id} className="search-history-row">
              <button
                type="button"
                className="search-history-open"
                onClick={() => onOpen(item.id)}
                disabled={busy}
                aria-busy={busyId === item.id}
              >
                <strong>{item.query}</strong>
                <small>{resultLabel(item.result_count)} · {relativeDate(item.updated_at)}</small>
              </button>
              <button
                type="button"
                className="search-history-remove"
                onClick={() => onDelete(item.id)}
                disabled={busy}
                aria-label={`Remover busca ${item.query}`}
                title="Remover do histórico"
              >
                <Icon name="trash" size={16} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="search-history-empty">
          Você ainda não tem buscas salvas. Quando encontrar produtos, a busca aparece aqui para voltar depois.
        </div>
      )}
      <div className="search-history-actions">
        {items.length > 0 && (
          <button
            type="button"
            className="search-history-clear"
            onClick={() => {
              if (confirmClear) onClear();
              else setConfirmClear(true);
            }}
            disabled={busy}
          >
            {clearing ? "Limpando…" : confirmClear ? "Confirmar limpeza?" : "Limpar histórico"}
          </button>
        )}
        <button type="button" className="ghost" onClick={onClose} disabled={busy}>
          Fechar
        </button>
      </div>
    </Modal>
  );
}
