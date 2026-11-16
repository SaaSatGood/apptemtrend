"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Icon from "@/components/ui/Icon";
import { friendlyError } from "@/lib/api";
import { usePlatform } from "../store";
import styles from "../Admin.module.css";
import { adminGet, adminPatch } from "./api";
import { fmtDateTime, formatCount } from "./format";
import type { AdminLead, AdminLeadPage } from "./types";
import { EmptyState, ErrorState, LoadingRows, Pagination, SectionHeading } from "./ui";

const PAGE_SIZE = 20;

const STATUS_OPTIONS: Array<{ value: string; label: string; className: string }> = [
  { value: "novo", label: "Novo", className: styles.leadNew },
  { value: "contatado", label: "Contatado", className: styles.leadContacted },
  { value: "qualificado", label: "Qualificado", className: styles.leadQualified },
  { value: "descartado", label: "Descartado", className: styles.leadDiscarded },
];

export default function LeadsTab({ token, onChanged }: { token?: string; onChanged: () => void }) {
  const { toast } = usePlatform();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [data, setData] = useState<AdminLeadPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const requestRef = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => { setQuery(search.trim()); setPage(1); }, 320);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    if (!token) return;
    const id = ++requestRef.current;
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (query) params.set("q", query);
      if (status) params.set("status", status);
      const result = await adminGet<AdminLeadPage>(`/admin/leads?${params.toString()}`, token);
      if (id === requestRef.current) setData(result);
    } catch {
      if (id === requestRef.current) setError(true);
    } finally {
      if (id === requestRef.current) setLoading(false);
    }
  }, [page, query, status, token]);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  const items = useMemo(() => data?.items ?? [], [data]);
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));
  const hasFilters = Boolean(query || status);

  const counts = useMemo(() => {
    const initial: Record<string, number> = { novo: 0, contatado: 0, qualificado: 0, descartado: 0 };
    for (const lead of items) initial[lead.status] = (initial[lead.status] ?? 0) + 1;
    return initial;
  }, [items]);

  async function setLeadStatus(lead: AdminLead, next: string) {
    setBusyId(lead.id);
    try {
      await adminPatch(`/admin/leads/${lead.id}/status`, { status: next }, token);
      setData((current) =>
        current
          ? { ...current, items: current.items.map((item) => (item.id === lead.id ? { ...item, status: next } : item)) }
          : current,
      );
      toast("Status do lead atualizado.");
      onChanged();
    } catch (err) {
      toast(friendlyError(err, "Não conseguimos atualizar o lead."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className={styles.viewPanel}>
      <SectionHeading
        eyebrow="Comercial"
        title="Leads de marca"
        description="Contatos enviados pela landing de marcas. Responda e acompanhe a qualificação."
      />

      <div className={`${styles.toolbar} ${styles.leadsToolbar}`}>
        <label className={styles.searchField}>
          <Icon name="search" size={18} />
          <input
            aria-label="Buscar leads"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome, e-mail ou telefone"
          />
        </label>
        <select aria-label="Filtrar leads por status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
          <option value="">Todos os status</option>
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      <div className={styles.listMeta}>
        <p>
          <strong>{formatCount(data?.total ?? 0)}</strong>{" "}
          {data?.total === 1 ? "lead recebido" : "leads recebidos"}
          {hasFilters ? " com os filtros atuais" : ""}
        </p>
        <button type="button" onClick={() => void load()} disabled={loading}>
          <Icon name="refresh" size={15} /> Atualizar
        </button>
      </div>

      {error && !data ? (
        <ErrorState message="Não foi possível carregar os leads." onRetry={() => void load()} />
      ) : loading && !data ? (
        <LoadingRows count={4} />
      ) : items.length === 0 ? (
        <EmptyState
          title={hasFilters ? "Nenhum lead corresponde aos filtros." : "Nenhum lead ainda."}
          description={
            hasFilters
              ? "Ajuste a busca ou o status para ver todos os contatos."
              : "Quando uma marca enviar o formulário da landing, o contato aparece aqui."
          }
          action={hasFilters ? "Limpar filtros" : undefined}
          onAction={hasFilters ? () => { setSearch(""); setQuery(""); setStatus(""); setPage(1); } : undefined}
        />
      ) : (
        <>
          <div className={styles.leadSummary}>
            {STATUS_OPTIONS.map((option) => (
              <div key={option.value}>
                <span>{option.label}</span>
                <strong>{formatCount(counts[option.value] ?? 0)}</strong>
              </div>
            ))}
          </div>

          <div className={styles.leadList}>
            {items.map((lead) => {
              const option = STATUS_OPTIONS.find((item) => item.value === lead.status);
              return (
                <article key={lead.id} className={styles.leadCard}>
                  <header>
                    <div>
                      <h3>{lead.nome}</h3>
                      <span className={`${styles.leadStatus} ${option?.className ?? ""}`}>
                        {option?.label ?? lead.status}
                      </span>
                    </div>
                    <time dateTime={lead.created_at}>{fmtDateTime(lead.created_at)}</time>
                  </header>
                  <p className={styles.leadMessage}>{lead.mensagem}</p>
                  <dl className={styles.leadContacts}>
                    <div>
                      <dt>E-mail</dt>
                      <dd><a href={`mailto:${lead.email}`}>{lead.email}</a></dd>
                    </div>
                    <div>
                      <dt>Telefone</dt>
                      <dd>
                        <a href={`https://wa.me/55${lead.telefone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                          {lead.telefone}
                        </a>
                      </dd>
                    </div>
                    <div>
                      <dt>Origem</dt>
                      <dd>{lead.source === "landing_marcas" ? "Landing de marcas" : lead.source || "—"}</dd>
                    </div>
                  </dl>
                  <footer>
                    <label>
                      Status
                      <select
                        aria-label={`Status do lead ${lead.nome}`}
                        value={lead.status}
                        disabled={busyId === lead.id}
                        onChange={(event) => void setLeadStatus(lead, event.target.value)}
                      >
                        {STATUS_OPTIONS.map((item) => (
                          <option key={item.value} value={item.value}>{item.label}</option>
                        ))}
                      </select>
                    </label>
                    <button type="button" onClick={() => { void navigator.clipboard?.writeText(lead.email); toast("E-mail copiado."); }}>
                      <Icon name="copy" size={14} /> Copiar e-mail
                    </button>
                  </footer>
                </article>
              );
            })}
          </div>

          {data && data.total > PAGE_SIZE && (
            <Pagination page={page} totalPages={totalPages} onChange={setPage} total={data.total} label="leads ·" />
          )}
        </>
      )}
    </div>
  );
}
