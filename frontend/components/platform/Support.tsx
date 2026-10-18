"use client";

import { useCallback, useEffect, useState } from "react";
import { api, friendlyError } from "@/lib/api";
import { resolveSession } from "@/lib/supabase";
import { usePlatform } from "./store";
import {
  SUPPORT_CATEGORY_LABEL,
  SUPPORT_STATUS_CLASS,
  SUPPORT_STATUS_LABEL,
  fmtSupportDateTime,
} from "@/lib/support";
import type { SupportMessage, SupportStatus, SupportTicket, SupportTicketThread } from "@/lib/types";

async function token(): Promise<string | undefined> {
  try {
    const session = await resolveSession();
    return session?.access_token;
  } catch {
    return undefined;
  }
}

export default function Support() {
  const { toast } = usePlatform();
  const [tickets, setTickets] = useState<SupportTicket[] | null>(null);
  const [listError, setListError] = useState(false);
  const [thread, setThread] = useState<SupportTicketThread | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);

  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("duvida");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState("");

  const [reply, setReply] = useState("");
  const [replying, setReplying] = useState(false);
  const [closing, setClosing] = useState(false);

  const loadTickets = useCallback(async () => {
    try {
      const accessToken = await token();
      const data = await api<{ items: SupportTicket[] }>("/support/tickets", accessToken);
      setTickets(data?.items ?? []);
      setListError(false);
    } catch {
      setListError(true);
    }
  }, []);

  useEffect(() => {
    const task = window.setTimeout(() => void loadTickets(), 0);
    return () => window.clearTimeout(task);
  }, [loadTickets]);

  async function openThread(id: string) {
    setLoadingThread(true);
    try {
      const accessToken = await token();
      const data = await api<SupportTicketThread>(`/support/tickets/${id}`, accessToken);
      setThread(data);
      setReply("");
    } catch (err) {
      toast(friendlyError(err, "Não conseguimos abrir esta conversa."));
    } finally {
      setLoadingThread(false);
    }
  }

  async function submitTicket(event: React.FormEvent) {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setFormError("");
    try {
      const accessToken = await token();
      const created = await api<SupportTicket>("/support/tickets", accessToken, {
        method: "POST",
        body: JSON.stringify({ subject: subject.trim(), category, message: message.trim() }),
      });
      setTickets((current) => [created, ...(current ?? [])]);
      setComposeOpen(false);
      setSubject("");
      setCategory("duvida");
      setMessage("");
      toast("Conversa aberta — respondemos por aqui mesmo.");
      await openThread(created.id);
    } catch (err) {
      setFormError(friendlyError(err, "Não conseguimos abrir a conversa agora. Tente novamente."));
    } finally {
      setSending(false);
    }
  }

  async function sendReply(event: React.FormEvent) {
    event.preventDefault();
    if (!thread || !reply.trim() || replying || thread.status === "closed") return;
    setReplying(true);
    try {
      const accessToken = await token();
      const result = await api<{ status: SupportStatus; message: SupportMessage }>(
        `/support/tickets/${thread.id}/messages`,
        accessToken,
        { method: "POST", body: JSON.stringify({ body: reply.trim() }) },
      );
      setThread((current) =>
        current
          ? { ...current, status: result.status, messages: [...current.messages, result.message] }
          : current,
      );
      setTickets((current) =>
        (current ?? []).map((t) => (t.id === thread.id ? { ...t, status: result.status, last_message_at: result.message.created_at } : t)),
      );
      setReply("");
    } catch (err) {
      toast(friendlyError(err, "Não conseguimos enviar sua mensagem agora."));
    } finally {
      setReplying(false);
    }
  }

  async function closeTicket() {
    if (!thread || closing) return;
    setClosing(true);
    try {
      const accessToken = await token();
      await api<{ ok: boolean }>(`/support/tickets/${thread.id}/close`, accessToken, { method: "POST" });
      setThread((current) => (current ? { ...current, status: "closed" } : current));
      setTickets((current) => (current ?? []).map((t) => (t.id === thread.id ? { ...t, status: "closed" } : t)));
      toast("Conversa encerrada. Se precisar, é só abrir outra.");
    } catch (err) {
      toast(friendlyError(err, "Não conseguimos encerrar a conversa agora."));
    } finally {
      setClosing(false);
    }
  }

  return (
    <section id="support-view" className="support-shell">
      <header className="support-hero">
        <div>
          <p className="eyebrow">Suporte</p>
          <h1>Conte com a <em>gente.</em></h1>
          <p className="support-hero-copy">
            Dúvidas, problemas ou sugestões — abra uma conversa e acompanhe a resposta por aqui mesmo.
            Você também recebe um aviso no email da conta.
          </p>
        </div>
        <button
          className="primary support-new"
          type="button"
          onClick={() => { setComposeOpen((open) => !open); setFormError(""); }}
          aria-expanded={composeOpen}
        >
          {composeOpen ? "Fechar formulário" : "Nova conversa"}
        </button>
      </header>

      {composeOpen && (
        <section className="card support-compose" aria-label="Nova conversa">
          <h2>Nova conversa</h2>
          <form className="stack" onSubmit={submitTicket}>
            <div className="support-compose-grid">
              <label>
                Assunto
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  minLength={3}
                  maxLength={120}
                  required
                  placeholder="Ex.: Não consigo gerar o roteiro de um produto"
                />
              </label>
              <label>
                Categoria
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  {Object.entries(SUPPORT_CATEGORY_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Descreva o que está acontecendo
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                minLength={5}
                maxLength={2000}
                rows={5}
                required
                placeholder="Quanto mais detalhe, mais rápido a gente resolve. Se puder, diga o produto ou a tela onde aconteceu."
              />
            </label>
            {formError && <p className="form-message error" role="alert">{formError}</p>}
            <div className="support-compose-actions">
              <button className="primary" type="submit" disabled={sending}>
                {sending ? "Enviando…" : "Enviar mensagem"}
              </button>
              <small className="muted">Respondemos em até 1 dia útil — planos Pro e Scale têm prioridade.</small>
            </div>
          </form>
        </section>
      )}

      <div className="support-layout">
        <section className="card support-list" aria-label="Suas conversas">
          <h2>Suas conversas</h2>
          {tickets === null && !listError && <p className="muted">Carregando conversas…</p>}
          {listError && (
            <p className="muted">
              Não conseguimos carregar suas conversas agora.{" "}
              <button className="link-like" type="button" onClick={() => void loadTickets()}>Tentar de novo</button>
            </p>
          )}
          {tickets?.length === 0 && (
            <p className="muted">Nenhuma conversa ainda. Quando precisar, clique em “Nova conversa”.</p>
          )}
          <ul className="support-ticket-list">
            {(tickets ?? []).map((ticket) => (
              <li key={ticket.id}>
                <button
                  type="button"
                  className={`support-ticket${thread?.id === ticket.id ? " is-active" : ""}`}
                  onClick={() => void openThread(ticket.id)}
                >
                  <span className="support-ticket-top">
                    <strong>{ticket.subject}</strong>
                    <span className={`support-status ${SUPPORT_STATUS_CLASS[ticket.status]}`}>{SUPPORT_STATUS_LABEL[ticket.status]}</span>
                  </span>
                  <span className="support-ticket-meta">
                    {SUPPORT_CATEGORY_LABEL[ticket.category] ?? ticket.category} · {fmtSupportDateTime(ticket.last_message_at)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="card support-thread" aria-label="Conversa">
          {!thread && !loadingThread && (
            <p className="muted support-thread-empty">Escolha uma conversa ao lado para ver as mensagens.</p>
          )}
          {loadingThread && !thread && <p className="muted">Abrindo conversa…</p>}
          {thread && (
            <>
              <header className="support-thread-head">
                <div>
                  <h2>{thread.subject}</h2>
                  <span className="support-ticket-meta">
                    {SUPPORT_CATEGORY_LABEL[thread.category] ?? thread.category} · aberta em {fmtSupportDateTime(thread.created_at)}
                  </span>
                </div>
                <span className={`support-status ${SUPPORT_STATUS_CLASS[thread.status]}`}>{SUPPORT_STATUS_LABEL[thread.status]}</span>
              </header>
              <ol className="support-messages">
                {thread.messages.map((msg) => (
                  <li key={msg.id} className={msg.author === "support" ? "is-support" : "is-creator"}>
                    <div className="support-bubble">
                      <p>{msg.body}</p>
                      <small>{msg.author === "support" ? "Suporte TemTrend" : "Você"} · {fmtSupportDateTime(msg.created_at)}</small>
                    </div>
                  </li>
                ))}
              </ol>
              {thread.status === "closed" ? (
                <p className="muted support-thread-empty">
                  Esta conversa foi encerrada. Para um novo assunto, abra outra conversa.
                </p>
              ) : (
                <form className="support-reply" onSubmit={sendReply}>
                  <label className="sr-only" htmlFor="support-reply-input">Sua mensagem</label>
                  <textarea
                    id="support-reply-input"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    placeholder="Escreva sua mensagem…"
                  />
                  <div className="support-reply-actions">
                    <button className="primary" type="submit" disabled={replying || !reply.trim()}>
                      {replying ? "Enviando…" : "Enviar"}
                    </button>
                    <button className="ghost" type="button" disabled={closing} onClick={() => void closeTicket()}>
                      {closing ? "Encerrando…" : "Encerrar conversa"}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </section>
      </div>
    </section>
  );
}
