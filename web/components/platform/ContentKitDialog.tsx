"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { api, friendlyError, type ApiError } from "@/lib/api";
import { usePlatform } from "./store";

const SUGGESTIONS = [
  "Tom mais agressivo e direto",
  "Vídeo curto, com no máximo 15 segundos",
  "Vídeo sem aparecer, mostrando somente o produto e as mãos",
  "Estilo UGC natural, como uma recomendação pessoal",
  "Começar mostrando o problema e depois a solução",
];

export default function ContentKitDialog({
  productId,
  mode,
  forceNew,
  onClose,
  onCreated,
}: {
  productId: string;
  mode: "save" | "kit";
  forceNew: boolean;
  onClose: () => void;
  onCreated: (kit: import("@/lib/types").ContentKit, fallback: boolean) => void;
}) {
  const { toast, loadProductions } = usePlatform();
  const [briefing, setBriefing] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function toggleSuggestion(suggestion: string) {
    const isSelected = selected.includes(suggestion);
    const next = isSelected ? selected.filter((s) => s !== suggestion) : [...selected, suggestion];
    setSelected(next);
    const current = briefing.trim();
    if (!isSelected) {
      if (!current.includes(suggestion)) setBriefing(current ? `${current}. ${suggestion}` : suggestion);
    } else if (current.includes(suggestion)) {
      setBriefing(
        current.replace(suggestion, "").replace(/\.\s*\./g, ".").replace(/\s{2,}/g, " ").trim().replace(/^\.\s*/, "")
      );
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = briefing.trim();
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
        toast("Produto e Content Kit exclusivo salvos ✓");
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
            ? "IA indisponível — salvamos um roteiro base. Gere outra versão depois."
            : result?.created
              ? "Seu Content Kit exclusivo foi criado ✓"
              : "Seu Content Kit existente foi reutilizado ✓"
        );
      }
    } catch (err) {
      const code = (err as ApiError).code;
      setError(
        code === "AI_UNAVAILABLE"
          ? "A IA está indisponível agora. Tente novamente em alguns minutos."
          : code === "SERVICE_UNAVAILABLE"
            ? "Não conseguimos gerar seu Content Kit agora. Tente novamente em alguns segundos."
            : friendlyError(err, "Não conseguimos preparar seu Content Kit agora. Tente novamente.")
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog className="publication-dialog content-kit-dialog" open>
      <form className="stack" onSubmit={submit}>
        <button className="dialog-close" type="button" aria-label="Fechar" onClick={onClose}>
          ×
        </button>
        <p className="eyebrow">SEU CONTENT KIT</p>
        <h2>Como você quer gravar?</h2>
        <p className="muted">
          Descreva o tom, a duração, se vai aparecer, o estilo e qualquer detalhe importante. Este
          roteiro será exclusivo para a sua conta.
        </p>
        <div className="briefing-suggestions" aria-label="Sugestões para o briefing">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={selected.includes(s)}
              className={selected.includes(s) ? "selected" : ""}
              onClick={() => toggleSuggestion(s)}
            >
              {s === SUGGESTIONS[0] ? "Mais agressivo" : s === SUGGESTIONS[1] ? "Vídeo de 15s" : s === SUGGESTIONS[2] ? "Sem aparecer" : s === SUGGESTIONS[3] ? "UGC natural" : "Problema e solução"}
            </button>
          ))}
        </div>
        <label>
          Orientações para a IA
          <textarea
            rows={6}
            maxLength={1500}
            placeholder="Ex.: Quero um vídeo curto de 15 segundos, mais agressivo, sem aparecer e com foco no antes e depois."
            value={briefing}
            onChange={(e) => setBriefing(e.target.value)}
          />
        </label>
        <small className="muted">{briefing.length} de 1500 caracteres</small>
        {error && <p className="form-message error" role="alert">{error}</p>}
        <button className="primary" type="submit" disabled={busy}>
          {busy
            ? mode === "save"
              ? "Salvando e gerando seu Content Kit..."
              : "Gerando seu Content Kit..."
            : mode === "save"
              ? "Salvar produto e criar meu kit →"
              : forceNew
                ? "Gerar outra versão →"
                : "Gerar meu Content Kit →"}
        </button>
      </form>
    </dialog>
  );
}
