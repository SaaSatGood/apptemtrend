"use client";

import Link from "next/link";
import { useState } from "react";
import { copyText, formatUpdated, displayProductName, FALLBACK_IMAGE, validTikTokUrl } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { api } from "@/lib/api";
import type { CreatorContent } from "@/lib/types";
import { usePlatform } from "./store";
import Image from "next/image";

const FILTERS = [
  ["todos", "Todos"],
  ["em_producao", "Em produção"],
  ["gravado", "Gravados"],
  ["publicado", "Publicados"],
] as const;

type Filter = (typeof FILTERS)[number][0];

const STATUS_LABEL: Record<string, string> = {
  salvo: "Produto escolhido",
  em_producao: "Content Kit escolhido",
  gravado: "Vídeo gravado",
  publicado: "Publicado ✓",
};

const NEXT_LABEL: Record<string, string> = {
  salvo: "Escolher Content Kit →",
  em_producao: "Produzir vídeo →",
  publicado: "Ver produção →",
};

function progressIndex(status: string): number {
  return ({ salvo: 1, em_producao: 2, gravado: 3, publicado: 4 } as Record<string, number>)[status] || 1;
}

export default function Production() {
  const { productions, toast } = usePlatform();
  const [filter, setFilter] = useState<Filter>("todos");

  function count(f: Filter): number {
    if (f === "todos") return productions.length;
    if (f === "em_producao")
      return productions.filter((i) => ["salvo", "em_producao"].includes(i.status)).length;
    return productions.filter((i) => i.status === f).length;
  }

  const visible = productions.filter(
    (item) =>
      filter === "todos" ||
      (filter === "em_producao" && ["salvo", "em_producao"].includes(item.status)) ||
      item.status === filter
  );

  async function copyHook(content: CreatorContent) {
    const ok = await copyText(content.content_kits?.hook || "");
    toast(ok ? "Hook copiado ✓" : "Não conseguimos copiar. Tente novamente.");
  }

  function findProduct() {
    document.getElementById("assistant-input")?.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <section id="production-section" className="dashboard-section production-section">
      <div className="section-title">
        <div>
          <h2>Minha produção</h2>
          <p>Acompanhe seus conteúdos e veja o próximo passo.</p>
        </div>
      </div>
      <div id="production-filters" className="production-filters" role="group" aria-label="Filtrar produção">
        {FILTERS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            className={filter === value ? "active" : ""}
            onClick={() => setFilter(value)}
          >
            {label} ({count(value)})
          </button>
        ))}
      </div>
      <div id="my-content" className="production-grid">
        {!productions.length ? (
          <div className="empty-state">
            <h3>Você ainda não começou nenhuma produção.</h3>
            <p>Conte o que quer vender e escolha seu primeiro produto.</p>
            <button className="primary" type="button" onClick={findProduct}>
              Encontrar produto →
            </button>
          </div>
        ) : !visible.length ? (
          <div className="empty-state">
            <h3>Nenhum conteúdo neste status.</h3>
            <p>Escolha outro filtro ou encontre um produto para começar.</p>
            <button className="primary" type="button" onClick={findProduct}>
              Encontrar produto →
            </button>
          </div>
        ) : (
          visible.map((c) => {
            const kit = c.content_kits;
            const product = c.products ?? { id: c.product_id, nome: "Produto" };
            const current = progressIndex(c.status);
            return (
              <article key={c.id} className="production-card">
                <Image
                  src={c.products?.imagem_url || FALLBACK_IMAGE}
                  alt={displayProductName(product)}
                  width={110}
                  height={120}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
                  }}
                />
                <div className="production-info">
                  <h3>{displayProductName(product)}</h3>
                  <p className="production-kit-name">{kit?.titulo || "Content Kit ainda não escolhido"}</p>
                  <span className={`production-status status-${c.status}`}>
                    {STATUS_LABEL[c.status] || c.status}
                  </span>
                  <small>Atualizado em {formatUpdated(c.atualizado_em)}</small>
                  <div className="production-progress">
                    <strong>{current} de 4 etapas</strong>
                    {[
                      ["salvo", "Produto escolhido"],
                      ["em_producao", "Content Kit escolhido"],
                      ["gravado", "Vídeo gravado"],
                      ["publicado", "Publicado"],
                    ].map(([status, label], index) => (
                      <span key={status} className={index < current ? "done" : ""}>
                        {index < current ? "✓" : "○"} {label}
                      </span>
                    ))}
                  </div>
                  {c.status === "gravado" ? (
                    <ProductionPublishButton content={c} />
                  ) : (
                    <Link
                      className="production-action continue-production"
                      href={
                        kit && c.products
                          ? `/app/produtos/${c.products.id}/kits/${kit.id}`
                          : `/app/produtos/${c.product_id}`
                      }
                    >
                      {NEXT_LABEL[c.status] || "Ver produção →"}
                    </Link>
                  )}
                  {kit?.hook && (
                    <button className="production-action" type="button" onClick={() => copyHook(c)}>
                      Copiar hook
                    </button>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

function ProductionPublishButton({ content }: { content: CreatorContent }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="production-action" type="button" onClick={() => setOpen(true)}>
        Marcar como publicado →
      </button>
      {open && <PublicationDialog content={content} onClose={() => setOpen(false)} />}
    </>
  );
}

export function PublicationDialog({
  content,
  onClose,
}: {
  content: CreatorContent;
  onClose: () => void;
}) {
  const { toast, loadProductions } = usePlatform();
  const [url, setUrl] = useState(content.published_url || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = url.trim();
    if (!validTikTokUrl(value)) {
      setError("Cole um link válido do TikTok.");
      return;
    }
    setBusy(true);
    try {
      const { data } = await supabase().auth.getSession();
      await api(`/creator-content/${content.id}`, data.session?.access_token, {
        method: "PATCH",
        body: JSON.stringify({ status: "publicado", published_url: value || null }),
      });
      onClose();
      await loadProductions().catch(() => {});
      toast(value ? "Publicado ✓ Link salvo." : "Conteúdo marcado como publicado.");
    } catch {
      setError("Não conseguimos salvar a publicação. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog className="publication-dialog" open onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <button className="dialog-close" type="button" aria-label="Fechar" onClick={onClose}>
          ×
        </button>
        <p className="eyebrow">PUBLICAÇÃO</p>
        <h2>Seu vídeo já foi publicado?</h2>
        <p className="muted">
          Publique fora da TemTrend e cole o link do TikTok aqui, se quiser. Também dá para marcar
          como publicado sem adicionar o link agora.
        </p>
        <label>
          Link do TikTok (opcional)
          <input
            type="url"
            inputMode="url"
            placeholder="https://www.tiktok.com/@usuario/video/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
        {error && <p className="form-message error" role="alert">{error}</p>}
        <button className="primary" type="submit" disabled={busy}>
          {busy ? "Salvando..." : "Salvar publicação →"}
        </button>
      </form>
    </dialog>
  );
}
