"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { api, friendlyError, type ApiError } from "@/lib/api";
import { usePlatform } from "./store";

const SUGGESTIONS = [
  { label: "Direto ao ponto", instruction: "Use um tom direto e objetivo." },
  { label: "Até 15 segundos", instruction: "Crie um vídeo curto, com no máximo 15 segundos." },
  { label: "Sem aparecer", instruction: "Mostre somente o produto e as mãos, sem mostrar o rosto." },
  { label: "Recomendação natural", instruction: "Use um tom natural, como uma recomendação pessoal." },
  { label: "Problema e solução", instruction: "Comece com um problema real e mostre a solução com o produto." },
];

export default function ContentKitDialog({
  productId,
  mode,
  forceNew,
  initialBriefing = "",
  onClose,
  onCreated,
}: {
  productId: string;
  mode: "save" | "kit";
  forceNew: boolean;
  initialBriefing?: string;
  onClose: () => void;
  onCreated: (kit: import("@/lib/types").ContentKit, fallback: boolean) => void;
}) {
  const { toast, loadProductions } = usePlatform();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [briefing, setBriefing] = useState(initialBriefing);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const selectedInstructions = SUGGESTIONS.filter((item) => selected.includes(item.label)).map((item) => item.instruction);
  const customLimit = Math.max(0, 1500 - selectedInstructions.join(" ").length - (selectedInstructions.length ? 1 : 0));
  const tooLong = briefing.trim().length > customLimit;

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement as HTMLElement | null;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
      queueMicrotask(() => { if (trigger?.isConnected) trigger.focus(); });
    };
  }, []);

  function toggleSuggestion(label: string) {
    setError("");
    setSelected((current) => current.includes(label) ? current.filter((item) => item !== label) : [...current, label]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const text = [...selectedInstructions, briefing.trim()].filter(Boolean).join(" ");
    if (text.length > 1500) {
      setError("Resuma os detalhes para caber em 1500 caracteres.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const { data } = await supabase().auth.getSession();
      const token = data.session?.access_token;
      if (mode === "save") {
        await api("/creator-content", token, {
          method: "POST",
          body: JSON.stringify({ product_id: productId, content_kit_briefing: text || undefined }),
        });
        await loadProductions().catch(() => {});
        onClose();
        toast("Produto salvo ✓ Seu conteúdo está na área Produção.");
      } else {
        const result = await api<{ content_kit?: import("@/lib/types").ContentKit; created?: boolean; fallback?: boolean }>(
          `/products/${productId}/content-kit`,
          token,
          { method: "POST", body: JSON.stringify({ force_new: forceNew, instructions: text || undefined }) }
        );
        await loadProductions().catch(() => {});
        onClose();
        if (result?.content_kit) {
          onCreated(result.content_kit, Boolean(result.fallback));
        }
        toast(
          result?.fallback
            ? "IA indisponível. Salvamos um roteiro base para você gerar outra versão depois."
            : result?.created
              ? "Conteúdo criado ✓ Agora você pode começar a produção."
              : "Seu conteúdo está pronto ✓"
        );
      }
    } catch (err) {
      const code = (err as ApiError).code;
      setError(
        code === "AI_UNAVAILABLE"
          ? "A IA está indisponível agora. Tente novamente em alguns minutos."
          : code === "SERVICE_UNAVAILABLE"
            ? "Não conseguimos gerar seu plano de gravação agora. Tente novamente em alguns segundos."
            : friendlyError(err, "Não conseguimos preparar seu plano de gravação agora. Tente novamente.")
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="publication-dialog content-kit-dialog"
      aria-modal="true"
      aria-labelledby="content-kit-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <form className="stack content-kit-form" onSubmit={submit}>
        <button className="dialog-close" type="button" aria-label="Fechar" disabled={busy} onClick={onClose}>
          ×
        </button>
        <header className="content-kit-form-header">
          <p className="eyebrow">{mode === "save" ? "Salvar e criar" : forceNew ? "Nova versão" : "Novo conteúdo"}</p>
          <h2 id="content-kit-dialog-title">{mode === "save" ? "Salve sua ideia." : forceNew ? "Teste outro ângulo." : "Seu vídeo começa aqui."}</h2>
          <p className="muted">Escolha como quer gravar. Você poderá revisar o roteiro antes da produção.</p>
        </header>
        <fieldset className="content-kit-style">
          <legend>Estilo do vídeo <span>(opcional)</span></legend>
          <div className="briefing-suggestions">
            {SUGGESTIONS.map(({ label }) => (
              <button
                key={label}
                type="button"
                aria-pressed={selected.includes(label)}
                className={selected.includes(label) ? "selected" : ""}
                onClick={() => toggleSuggestion(label)}
              >
                {selected.includes(label) ? "✓ " : "+ "}{label}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="content-kit-custom">
          <span>Algum detalhe importante? <small>(opcional)</small></span>
          <textarea
            rows={3}
            maxLength={customLimit}
            placeholder="Ex.: Tenho pouco espaço e quero mostrar o produto em uso."
            value={briefing}
            onChange={(e) => { setBriefing(e.target.value); setError(""); }}
          />
        </label>
        <small className={`content-kit-count${tooLong ? " is-over-limit" : ""}`}>{briefing.length}/{customLimit}{tooLong ? " · Resuma os detalhes para continuar" : ""}</small>
        {error && <p className="form-message error" role="alert">{error}</p>}
        <div className="content-kit-form-actions">
          <button className="ghost" type="button" disabled={busy} onClick={onClose}>Cancelar</button>
          <button className="primary" type="submit" disabled={busy || tooLong}>
            {busy ? "Preparando seu roteiro…" : mode === "save" ? "Salvar e criar roteiro →" : forceNew ? "Gerar outra versão →" : "Criar conteúdo →"}
          </button>
        </div>
        <p className="content-kit-form-note">Suas escolhas orientam o roteiro. Você pode gerar outra versão depois.</p>
      </form>
    </dialog>
  );
}
