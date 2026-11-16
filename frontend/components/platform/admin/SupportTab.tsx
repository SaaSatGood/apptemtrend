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

const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: "", label: "Todos os status" },
  { value: "open", label: "Aguardando suporte" },
  { value: "answered", label: "Respondidas" },
  { value: "resolved", label: "Resolvidas" },
  { value: "closed", label: "Encerradas" },
];

export default function SupportTab({ token }: { token?: string }) {
  const { toast } = usePlatform();
  const [tickets, setTickets] = useState<AdminSupportTicket[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("open");
  const [error, setError] = useState(false);
  const [thread, setThread] = useState<AdminSupportTicketThread | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setError(false);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (status) params.set("status", status);
      const data = await adminGet<{ items: AdminSupportTicket[]; total: number }>(
        `/admin/support/tickets?${params.toString()}`,
        token,
      );
      setTickets(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setError(true);
    }
  }, [page, status, token]);

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
      await adminPatch(`/admin/support/tickets/${thread.id}`, { status: next }, token);
      setThread((current) => (current ? { ...current, status: next } : current));
      setTickets((current) =>
        (current ?? []).map((ticket) => (ticket.id === thread.id ? { ...ticket, status: next } : ticket)),
      );
      toast(next === "resolved" ? "Conversa marcada como resolvida." : next === "closed" ? "Conversa encerrada." : "Conversa reaberta.");
    } catch (err) {
      toast(friendlyError(err, "Não conseguimos atualizar o status agora."));
    } finally {
      setBusy(false);
    }
  }

  const list = tickets ?? [];
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className={styles.viewPanel}>
      <SectionHeading
        eyebrow="Atendimento"
        title="Conversas do suporte"
        description="Responda por aqui — o creator vê a resposta na área Suporte, dentro da plataforma."
      />

      <div className={`${styles.toolbar} ${styles.supportToolbar}`}>
        <select aria-label="Filtrar conversas por status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); setThread(null); }}>
          {STATUS_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <button type="button" className={styles.secondaryButton} onClick={() => void load()}>
          <Icon name="refresh" size={16} /> Atualizar fila
        </button>
      </div>

      {error && tickets === null ? (
        <ErrorState message="Não foi possível carregar a fila de suporte." onRetry={() => void load()} />
      ) : tickets === null ? (
        <p className={styles.mutedText}>Carregando conversas…</p>
      ) : list.length === 0 ? (
        <EmptyState
          title={status ? "Nenhuma conversa com este status." : "Nenhuma conversa no momento."}
          description="Quando um creator abrir um atendimento, ele aparece aqui para resposta."
          action={status ? "Ver todas" : undefined}
          onAction={status ? () => { setStatus(""); setPage(1); } : undefined}
        />
      ) : (
        <>
          <p className={styles.listMetaCount}>
            <strong>{formatCount(total)}</strong> {total === 1 ? "conversa" : "conversas"} neste filtro
          </p>
          <div className="support-layout">
            <section className="card support-list">
              <h2>{total > 0 ? `${formatCount(total)} na fila` : "Fila em ordem"}</h2>
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
                <Pagination page={page} totalPages={pages} onChange={setPage} total={total} label="conversas ·" />
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
