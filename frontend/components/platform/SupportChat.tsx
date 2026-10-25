"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/Icon";
import { api, friendlyError } from "@/lib/api";
import { resolveSession } from "@/lib/supabase";

type ChatMessage = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Como salvo um produto na produção?",
  "Como gero o roteiro do meu vídeo?",
  "Como publico um vídeo gravado?",
  "Quais são os limites do meu plano?",
];

/** Assistente de suporte com a mesma IA que responde a busca de produtos. */
export default function SupportChat({ onOpenTicket }: { onOpenTicket: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, sending]);

  async function send(question: string) {
    const value = question.trim();
    if (!value || sending) return;
    setError("");
    setText("");
    const history = messages.slice(-8);
    setMessages((current) => [...current, { role: "user", content: value }]);
    setSending(true);
    try {
      const session = await resolveSession();
      const data = await api<{ reply: string }>("/support/chat", session?.access_token, {
        method: "POST",
        body: JSON.stringify({ message: value, history }),
      });
      setMessages((current) => [
        ...current,
        { role: "assistant", content: data?.reply?.trim() || "Não consegui responder agora. Abra uma conversa que o time te ajuda." },
      ]);
    } catch (err) {
      setError(friendlyError(err, "Não conseguimos responder agora. Tente de novo ou abra uma conversa."));
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="support-chat" aria-label="Assistente de suporte">
      <header className="support-chat-head">
        <span className="support-chat-mark">
          <Icon name="sparkles" size={16} filled />
        </span>
        <div className="support-chat-head-copy">
          <h2>Assistente de suporte</h2>
          <p>Pergunte sobre a plataforma. É a mesma IA que prepara seus roteiros.</p>
        </div>
        <button className="ghost" type="button" onClick={onOpenTicket}>Falar com o time</button>
      </header>

      <div className="support-chat-log" ref={logRef} aria-live="polite">
        {messages.length === 0 ? (
          <div className="support-chat-empty">
            <strong>O que você precisa resolver?</strong>
            <div className="support-chat-suggestions">
              {SUGGESTIONS.map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => void send(suggestion)}>
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`support-chat-msg is-${message.role}`}>
              {message.content}
            </div>
          ))
        )}
        {sending && <div className="support-chat-msg is-assistant is-typing">Consultando o assistente…</div>}
      </div>

      {error && <p className="form-message error" role="alert">{error}</p>}

      <form
        className="support-chat-form"
        onSubmit={(event) => {
          event.preventDefault();
          void send(text);
        }}
      >
        <input
          type="text"
          value={text}
          maxLength={2000}
          onChange={(event) => setText(event.target.value)}
          placeholder="Escreva sua dúvida sobre a plataforma"
          aria-label="Mensagem para o assistente de suporte"
        />
        <button className="primary" type="submit" disabled={sending || text.trim().length < 2}>
          {sending ? "Perguntando…" : "Perguntar"}
        </button>
      </form>
    </section>
  );
}
