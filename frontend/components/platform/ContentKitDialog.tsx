"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { api, friendlyError, type ApiError } from "@/lib/api";
import { track, ttvMs } from "@/lib/track";
import { usePlatform } from "./store";
import ProductImage from "./ProductImage";
import { displayProductName } from "@/lib/format";
import type { Product } from "@/lib/types";

const SUGGESTIONS = [
  { label: "Direto ao ponto", description: "Sem introdução longa", group: "Tom", instruction: "Use um tom direto e objetivo." },
  { label: "Até 15 segundos", description: "Rápido para gravar", group: "Duração", instruction: "Crie um vídeo curto, com no máximo 15 segundos." },
  { label: "Sem aparecer", description: "Produto e mãos em cena", group: "Gravação", instruction: "Mostre somente o produto e as mãos, sem mostrar o rosto." },
  { label: "Recomendação natural", description: "Tom de conversa real", group: "Tom", instruction: "Use um tom natural, como uma recomendação pessoal." },
  { label: "Problema e solução", description: "Mostre o antes e depois", group: "Narrativa", instruction: "Comece com um problema real e mostre a solução com o produto." },
];
const BRIEFING_CHIPS = ["Mostrar preço", "Sem rosto", "Falar de frete"];

export default function ContentKitDialog({
  productId,
  product,
  mode,
  forceNew,
  initialBriefing = "",
  onClose,
  onCreated,
}: {
  productId: string;
  product?: Product | null;
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
  const [planLimit, setPlanLimit] = useState(false);
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

  function addBriefingChip(label: string) {
    setBriefing((current) => current.toLocaleLowerCase("pt-BR").includes(label.toLocaleLowerCase("pt-BR")) ? current : [current.trim(), label + "."].filter(Boolean).join(" "));
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
    setPlanLimit(false);
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
          track("kit_created", { fallback: Boolean(result.fallback), force_new: forceNew ? 1 : 0, ttv_ms: ttvMs() ?? 0 });
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
      setPlanLimit(code === "PLAN_LIMIT");
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
        <div className="content-kit-workspace">
          <header className="content-kit-form-header">
            <p className="eyebrow">{mode === "save" ? "Salvar produto" : forceNew ? "Nova versão" : "Roteiro para vídeo"}</p>
            <h2 id="content-kit-dialog-title">{mode === "save" ? "Salve este produto." : forceNew ? "Teste outro ângulo." : "Gere seu roteiro."}</h2>
            <p className="muted">{mode === "save" ? "Guarde o produto e sua direção para criar o roteiro depois." : "Escolha uma direção. A TemTrend organiza cenas, fala e legenda para você revisar."}</p>
            {product && <div className="content-kit-product-context"><ProductImage product={product} width={64} height={64} /><div><span>Produto do roteiro</span><strong>{displayProductName(product)}</strong></div></div>}
          </header>
          <div className="content-kit-editor">
            <fieldset className="content-kit-style">
              <legend>Como você quer gravar? <span>As opções escolhidas são combinadas em um único roteiro.</span></legend>
              <div className="briefing-suggestions">
                {SUGGESTIONS.map(({ label, description }) => {
                  const isSelected = selected.includes(label);
                  return (
                    <button
                      key={label}
                      type="button"
                      aria-label={`${label}, ${isSelected ? "selecionado" : "não selecionado"}`}
                      aria-pressed={isSelected}
                      className={isSelected ? "selected" : ""}
                      onClick={() => toggleSuggestion(label)}
                    >
                      <span className="content-kit-option-mark" aria-hidden="true">{isSelected ? "✓" : ""}</span>
                      <span className="content-kit-option-copy"><span className="content-kit-option-group">{SUGGESTIONS.find((item) => item.label === label)?.group}</span><strong>{label}</strong><small aria-hidden="true">{description}</small></span>
                    </button>
                  );
                })}
              </div>
              <p className="content-kit-selection" role="status">{selected.length ? `${selected.length} ${selected.length === 1 ? "estilo escolhido" : "estilos escolhidos"}` : "Nenhum escolhido: a TemTrend decide por você."}</p>
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
            <div className="content-kit-briefing-chips" role="group" aria-label="Sugestões para o roteiro">{BRIEFING_CHIPS.map((label) => <button key={label} type="button" onClick={() => addBriefingChip(label)}>{label}</button>)}</div>
            <p className="content-kit-edit-note">Depois, você poderá gerar outra versão para mudar a direção.</p>
            <small className={`content-kit-count${tooLong ? " is-over-limit" : ""}`}>{briefing.length}/{customLimit}{tooLong ? ". Resuma os detalhes para continuar" : ""}</small>
            {error && <p className="form-message error" role="alert">{error}</p>}
            {planLimit && (
              <p className="form-message">
                <Link href="/planos" onClick={onClose}>Ver planos e limites →</Link>
              </p>
            )}
          </div>
        </div>
        <footer className="content-kit-footer">
          <div className="content-kit-form-actions">
            <button className="ghost" type="button" disabled={busy} onClick={onClose}>Cancelar</button>
            <button className="primary" type="submit" disabled={busy || tooLong}>
              {busy ? "Preparando…" : mode === "save" ? "Salvar produto" : forceNew ? "Gerar outra versão" : "Gerar roteiro"}
            </button>
          </div>
        </footer>
      </form>
    </dialog>
  );
}
