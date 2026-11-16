"use client";

import { useCallback, useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";
import { friendlyError } from "@/lib/api";
import {
  SUPPORT_CATEGORY_LABEL,
  SUPPORT_STATUS_CLASS,
  SUPPORT_STATUS_LABEL,
  fmtSupportDateTime,
} from "@/lib/support";
import type { AdminSupportTicket, AdminSupportTicketThread, SupportMessage, SupportStatus } from "@/lib/types";
import { usePlatform } from "../store";
import styles from "../Admin.module.css";
import { adminGet, adminPatch, adminPost } from "./api";
import { formatCount } from "./format";
import { EmptyState, ErrorState, Pagination, SectionHeading } from "./ui";

const PAGE_SIZE = 50;

const STATUS_FILTERS: Array<{ value: "" | SupportStatus; label: string }> = [
  { value: "", label: "Todas" },
  { value: "open", label: "Aguardando" },
  { value: "answered", label: "Respondidas" },
  { value: "resolved", label: "Resolvidas" },
  { value: "closed", label: "Encerradas" },
];

type TicketCounts = Partial<Record<SupportStatus, number>>;

export default function SupportTab({ token }: { token?: string }) {
  const { toast } = usePlatform();
  const [tickets, setTickets] = useState<AdminSupportTicket[] | null>(null);
  const [counts, setCounts] = useState<TicketCounts>({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"" | SupportStatus>("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState(false);
  const [thread, setThread] = useState<AdminSupportTicketThread | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);

  // Busca com debounce para não consultar a cada tecla.
  useEffect(() => {
    const timer = window.setTimeout(() => { setQuery(search.trim()); setPage(1); }, 320);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    if (!token) return;
    setError(false);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (status) params.set("status", status);
      if (query) params.set("q", query);
      const data = await adminGet<{ items: AdminSupportTicket[]; total: number; counts?: TicketCounts }>(
        `/admin/support/tickets?${params.toString()}`,
        token,
      );
      setTickets(data.items ?? []);
      setTotal(data.total ?? 0);
      setCounts(data.counts ?? {});
    } catch {
      setError(true);
    }
  }, [page, query, status, token]);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  async function openThread(id: string) {
    setLoadingThread(true);
    try {
      const data = await adminGet<AdminSupportTicketThread>(`/admin/support/tickets/${id}`, token);
      setThread(data);
      setReply("");
    } catch (err) {
      toast(friendlyError(err, "Não conseguimos abrir esta conversa agora."));
    } finally {
      setLoadingThread(false);
    }
  }

  async function sendReply(event: React.FormEvent) {
    event.preventDefault();
    if (!thread || !reply.trim() || busy) return;
    setBusy(true);
    try {
      const result = await adminPost<{ status: SupportStatus; message: SupportMessage }>(
        `/admin/support/tickets/${thread.id}/messages`,
        { body: reply.trim() },
        token,
      );
      setThread((current) =>
        current ? { ...current, status: result.status, messages: [...current.messages, result.message] } : current,
      );
      setTickets((current) =>
        (current ?? []).map((ticket) =>
          ticket.id === thread.id
            ? { ...ticket, status: result.status, last_message_at: result.message.created_at }
            : ticket,
        ),
      );
      setCounts((current) => {
        const next: TicketCounts = { ...current };
        if (next[thread.status] != null) next[thread.status] = Math.max(0, Number(next[thread.status]) - 1);
        next[result.status] = Number(next[result.status] ?? 0) + 1;
        return next;
      });
      setReply("");
      toast("Resposta enviada.");
    } catch (err) {
      toast(friendlyError(err, "Não conseguimos enviar a resposta agora."));
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(next: SupportStatus) {
    if (!thread || busy) return;
    setBusy(true);
    try {
      const previous = thread.status;
      await adminPatch(`/admin/support/tickets/${thread.id}`, { status: next }, token);
      setThread((current) => (current ? { ...current, status: next } : current));
      setTickets((current) =>
        (current ?? []).map((ticket) => (ticket.id === thread.id ? { ...ticket, status: next } : ticket)),
      );
      setCounts((current) => {
        const updated: TicketCounts = { ...current };
        if (updated[previous] != null) updated[previous] = Math.max(0, Number(updated[previous]) - 1);
        updated[next] = Number(updated[next] ?? 0) + 1;
        return updated;
      });
      toast(next === "resolved" ? "Conversa marcada como resolvida." : next === "closed" ? "Conversa encerrada." : "Conversa reaberta.");
    } catch (err) {
      toast(friendlyError(err, "Não conseguimos atualizar o status agora."));
    } finally {
      setBusy(false);
    }
  }

  const list = tickets ?? [];
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const openCount = Number(counts.open ?? 0);
  const allCount = Object.values(counts).reduce((sum, value) => sum + Number(value ?? 0), 0);

  return (
    <div className={styles.viewPanel}>
      <SectionHeading
        eyebrow="Atendimento"
        title="Conversas do suporte"
        description="Todos os tickets abertos pelos creators, com resposta e status em tempo real."
      />

      <div className={styles.supportChips} role="group" aria-label="Filtrar conversas por status">
        {STATUS_FILTERS.map((option) => {
          const count = option.value ? Number(counts[option.value] ?? 0) : allCount;
          return (
            <button
              key={option.value || "all"}
              type="button"
              aria-pressed={status === option.value}
              className={status === option.value ? styles.supportChipActive : ""}
              onClick={() => { setStatus(option.value); setPage(1); setThread(null); }}
            >
              {option.label}
              <span>{formatCount(count)}</span>
            </button>
          );
        })}
      </div>

      <div className={`${styles.toolbar} ${styles.supportToolbar}`}>
        <label className={styles.searchField}>
          <Icon name="search" size={18} />
          <input
            aria-label="Buscar tickets por assunto"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por assunto do ticket"
          />
        </label>
        <button type="button" className={styles.secondaryButton} onClick={() => void load()}>
          <Icon name="refresh" size={16} /> Atualizar fila
        </button>
      </div>

      <p className={styles.listMetaCount}>
        {openCount > 0
          ? `${formatCount(openCount)} ${openCount === 1 ? "conversa aguardando" : "conversas aguardando"} resposta`
          : "Nenhuma conversa aguardando resposta"}
        {total > 0 ? ` · ${formatCount(total)} neste filtro` : ""}
      </p>

      {error && tickets === null ? (
        <ErrorState message="Não foi possível carregar a fila de suporte." onRetry={() => void load()} />
      ) : tickets === null ? (
        <p className={styles.mutedText}>Carregando conversas…</p>
      ) : list.length === 0 ? (
        <EmptyState
          title={query || status ? "Nenhum ticket corresponde aos filtros." : "Nenhum ticket no momento."}
          description={
            query || status
              ? "Ajuste a busca ou o status para ver todos os atendimentos."
              : "Quando um creator abrir um atendimento, ele aparece aqui para resposta."
          }
          action={query || status ? "Limpar filtros" : undefined}
          onAction={query || status ? () => { setSearch(""); setQuery(""); setStatus(""); setPage(1); } : undefined}
        />
      ) : (
        <>
          <div className="support-layout">
            <section className="card support-list">
              <h2>{total > 0 ? `${formatCount(total)} ${total === 1 ? "ticket" : "tickets"}` : "Fila em ordem"}</h2>
              <ul className="support-ticket-list">
                {list.map((ticket) => (
                  <li key={ticket.id}>
                    <button
                      type="button"
                      className={`support-ticket${thread?.id === ticket.id ? " is-active" : ""}`}
                      onClick={() => void openThread(ticket.id)}
                      disabled={loadingThread}
                    >
                      <span className="support-ticket-top">
                        <strong>{ticket.subject}</strong>
                        <span className={`support-status ${SUPPORT_STATUS_CLASS[ticket.status]}`}>
                          {SUPPORT_STATUS_LABEL[ticket.status]}
                        </span>
                      </span>
                      <span className="support-ticket-meta">
                        {ticket.creator_nome || ticket.creator_email || "Creator"} ·{" "}
                        {SUPPORT_CATEGORY_LABEL[ticket.category] ?? ticket.category} · {fmtSupportDateTime(ticket.last_message_at)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {pages > 1 && (
                <Pagination page={page} totalPages={pages} onChange={setPage} total={total} label="tickets ·" />
              )}
            </section>

            <section className="card support-thread">
              {!thread ? (
                <p className="muted support-thread-empty">Escolha uma conversa ao lado para ver as mensagens e responder.</p>
              ) : (
                <>
                  <header className="support-thread-head">
                    <div>
                      <h2>{thread.subject}</h2>
                      <span className="support-ticket-meta">
                        {thread.creator_nome || thread.creator_email || "Creator"} ·{" "}
                        {SUPPORT_CATEGORY_LABEL[thread.category] ?? thread.category} · aberta em {fmtSupportDateTime(thread.created_at)}
                      </span>
                    </div>
                    <span className={`support-status ${SUPPORT_STATUS_CLASS[thread.status]}`}>
                      {SUPPORT_STATUS_LABEL[thread.status]}
                    </span>
                  </header>
                  <ol className="support-messages">
                    {thread.messages.map((msg) => (
                      <li key={msg.id} className={msg.author === "support" ? "is-support" : "is-creator"}>
                        <div className="support-bubble">
                          <p>{msg.body}</p>
                          <small>
                            {msg.author === "support" ? "Suporte TemTrend" : thread.creator_nome || "Creator"} ·{" "}
                            {fmtSupportDateTime(msg.created_at)}
                          </small>
                        </div>
                      </li>
                    ))}
                  </ol>
                  {thread.status === "closed" ? (
                    <div className="support-reply-actions">
                      <p className="muted">Conversa encerrada pelo creator. Precisa de algo? É só reabrir.</p>
                      <button className="ghost" type="button" disabled={busy} onClick={() => void updateStatus("open")}>
                        Reabrir
                      </button>
                    </div>
                  ) : (
                    <form className="support-reply" onSubmit={sendReply}>
                      <label className="sr-only" htmlFor="admin-support-reply">Resposta</label>
                      <textarea
                        id="admin-support-reply"
                        value={reply}
                        onChange={(event) => setReply(event.target.value)}
                        rows={3}
                        maxLength={2000}
                        placeholder="Escreva a resposta para o creator…"
                      />
                      <div className="support-reply-actions">
                        <button className="primary" type="submit" disabled={busy || !reply.trim()}>
                          {busy ? "Enviando…" : "Responder"}
                        </button>
                        <button className="ghost" type="button" disabled={busy} onClick={() => void updateStatus("resolved")}>
                          Marcar resolvida
                        </button>
                        <button className="ghost" type="button" disabled={busy} onClick={() => void updateStatus("closed")}>
                          Encerrar
                        </button>
                      </div>
                    </form>
                  )}
                </>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
