"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { copyText, formatUpdated, fullProductName, normalizeScenes, validTikTokUrl } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { api } from "@/lib/api";
import { track } from "@/lib/track";
import type { CreatorContent } from "@/lib/types";
import { usePlatform } from "./store";
import Modal from "./Modal";
import ProductImage from "./ProductImage";
import { readGuideProgress } from "./guide-progress";
import { displayKitTitle } from "./kit-presentation";

const FILTERS = [
  ["todos", "Todos"],
  ["salvo", "Salvos"],
  ["em_producao", "Em produção"],
  ["gravado", "Gravados"],
  ["publicado", "Publicados"],
] as const;

type Filter = (typeof FILTERS)[number][0];
type Sort = "prioridade" | "recentes" | "antigos";

const STATUS_LABEL: Record<string, string> = {
  salvo: "Salvo",
  em_producao: "Em produção",
  gravado: "Gravado",
  publicado: "Publicado ✓",
};

const PRIORITY: Record<string, number> = { em_producao: 0, salvo: 1, gravado: 2, publicado: 3 };

function nextHint(content: CreatorContent, scenesDone: number[]) {
  if (content.status === "salvo") return content.content_kits ? "Revisar roteiro" : "Criar conteúdo";
  if (content.status === "gravado") return "Publicar o vídeo";
  if (content.status === "publicado") return content.published_url ? "Vídeo publicado" : "Publicação registrada";
  const total = normalizeScenes(content.content_kits?.cenas).length;
  if (!total) return "Revisar roteiro";
  const next = Array.from({ length: total }, (_, index) => index).find((index) => !scenesDone.includes(index));
  return next == null ? "Concluir gravação" : `Gravar cena ${next + 1} de ${total}`;
}

function progressIndex(status: string): number {
  return ({ salvo: 1, em_producao: 2, gravado: 3, publicado: 4 } as Record<string, number>)[status] || 1;
}

function effectiveStatus(content: CreatorContent): CreatorContent["status"] {
  return content.status;
}

export default function Production() {
  const { productions, productionsLoading, productionsError, loadProductions, toast } = usePlatform();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("todos");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("prioridade");
  const [recorded, setRecorded] = useState<Record<string, number[]>>({});
  useEffect(() => {
    const progress: Record<string, number[]> = {};
    productions.forEach((item) => { if (item.content_kit_id) progress[item.content_kit_id] = readGuideProgress(item.content_kit_id).scenes; });
    queueMicrotask(() => setRecorded(progress));
  }, [productions]);

  function count(f: Filter): number {
    if (f === "todos") return productions.length;
    return productions.filter((i) => effectiveStatus(i) === f).length;
  }

  const visible = useMemo(() => {
    const search = query.trim().toLocaleLowerCase("pt-BR");
    const filtered = productions.filter(
      (item) =>
        filter === "todos" ||
        effectiveStatus(item) === filter
    ).filter((item) => {
      if (!search) return true;
      return [item.products?.nome, item.content_kits?.titulo]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("pt-BR").includes(search));
    });

    return filtered.sort((a, b) => {
      if (sort === "prioridade") return PRIORITY[a.status] - PRIORITY[b.status] || new Date(b.atualizado_em || 0).getTime() - new Date(a.atualizado_em || 0).getTime();
      const aTime = new Date(a.atualizado_em || 0).getTime();
      const bTime = new Date(b.atualizado_em || 0).getTime();
      return sort === "antigos" ? aTime - bTime : bTime - aTime;
    });
  }, [filter, productions, query, sort]);

  async function copyHook(content: CreatorContent) {
    const ok = await copyText(content.content_kits?.hook || "");
    toast(ok ? "Hook copiado ✓" : "Não conseguimos copiar. Tente novamente.");
  }

  function findProduct() {
    router.push("/app");
  }

  return (
    <section id="production-section" className="dashboard-section production-section">
      <div className="production-heading">
        <div>
          <p className="eyebrow">Sua central de conteúdo</p>
          <h1>Minha <em>produção.</em></h1>
          <p>Continue exatamente de onde parou em cada conteúdo.</p>
        </div>
        <button className="primary production-new" type="button" onClick={findProduct}>
          + Novo conteúdo
        </button>
      </div>
      <div className="production-toolbar">
        <div className="production-controls">
          <label className="production-search">
            <span className="sr-only">Buscar na produção</span>
            <input
              type="search"
              placeholder="Buscar produto ou roteiro"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query && (
              <button type="button" aria-label="Limpar busca" onClick={() => setQuery("")}>×</button>
            )}
          </label>
          <label className="production-sort">
            <span className="sr-only">Ordenação</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
              <option value="prioridade">Ordenar: próxima ação</option>
              <option value="recentes">Ordenar: mais recentes</option>
              <option value="antigos">Ordenar: mais antigos</option>
            </select>
          </label>
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
              {label} <span>{count(value)}</span>
            </button>
          ))}
        </div>
      </div>
      {!productionsLoading && productions.length > 0 && (
        <div className="production-results-bar" aria-live="polite">
          <p>
            <strong>{visible.length}</strong> {visible.length === 1 ? "conteúdo" : "conteúdos"}
            {query.trim() || filter !== "todos"
              ? visible.length === 1 ? " encontrado" : " encontrados"
              : " na sua produção"}
          </p>
          {(query.trim() || filter !== "todos") && (
            <button type="button" onClick={() => { setQuery(""); setFilter("todos"); }}>
              Limpar busca e filtros
            </button>
          )}
        </div>
      )}
      <div id="my-content" className="production-grid">
        {productionsError ? <div className="empty-state" role="alert"><h3>Não conseguimos atualizar sua produção.</h3><p>Seus conteúdos continuam salvos. Tente carregar novamente.</p><button className="ghost" type="button" disabled={productionsLoading} onClick={() => void loadProductions().catch(() => {})}>{productionsLoading ? "Carregando…" : "Tentar novamente"}</button></div> : productionsLoading && !productions.length ? (
          <><p className="production-loading-status" role="status">Carregando seus conteúdos e próximas ações…</p>{[0, 1, 2].map((item) => (
            <div key={item} className="production-card production-skeleton" aria-hidden="true">
              <div className="skeleton production-skeleton-image" />
              <div className="skeleton-lines"><span className="skeleton" /><span className="skeleton" /><span className="skeleton" /></div>
            </div>
          ))}</>
        ) : !productions.length ? (
          <div className="empty-state">
            <h3>Você ainda não começou nenhuma produção.</h3>
            <p>Conte o que quer vender e escolha seu primeiro produto.</p>
            <button className="ghost" type="button" onClick={findProduct}>
              Encontrar produto
            </button>
          </div>
        ) : !visible.length ? (
          <div className="empty-state">
            <h3>Nenhum conteúdo encontrado.</h3>
            <p>{filter === "gravado" ? "Quando você marcar todas as cenas como gravadas, o conteúdo aparece aqui." : filter === "publicado" ? "Depois de publicar um vídeo, ele aparece aqui." : filter === "em_producao" ? "Escolha um roteiro para começar uma produção." : filter === "salvo" ? "Salve um produto para encontrá-lo aqui." : "Limpe a busca ou escolha outro filtro para ver sua produção."}</p>
            {productions.some((item) => item.status === "em_producao") ? <button className="ghost" type="button" onClick={() => { setQuery(""); setFilter("em_producao"); }}>Continuar item em produção</button> : <button className="ghost" type="button" onClick={() => { setQuery(""); setFilter("todos"); }}>Ver todos</button>}
          </div>
        ) : (
          visible.map((c) => {
            const kit = c.content_kits;
            const product = c.products ?? { id: c.product_id, nome: "Produto" };
            const status = effectiveStatus(c);
            const current = progressIndex(status);
            return (
              <article key={c.id} className="production-card">
                <div className="production-image-wrap">
                  <ProductImage product={product} width={180} height={180} />
                  <span className={`production-step step-${current}`}>{current}/4</span>
                </div>
                <div className="production-info">
                  <div className="production-card-topline">
                    <span className={`production-status status-${status}`}>
                      {STATUS_LABEL[status] || status}
                    </span>
                    <small>Atualizado em {formatUpdated(c.atualizado_em)}</small>
                  </div>
                  <h3 title={fullProductName(product)}>{fullProductName(product)}</h3>
                  {kit?.titulo && displayKitTitle(kit, product).toLocaleLowerCase("pt-BR") !== fullProductName(product).toLocaleLowerCase("pt-BR") && <p className="production-kit-name">{displayKitTitle(kit, product)}</p>}
                  <div className="production-progress-compact" aria-label={`Etapa ${current} de 4`}>
                    {[1, 2, 3, 4].map((step) => (
                      <span key={step} className={step <= current ? "done" : ""} />
                    ))}
                  </div>
                  <p className="production-next-hint">{nextHint(c, recorded[c.content_kit_id || ""] || [])}</p>
                  <div className="production-card-actions">
                    {status === "publicado" && c.published_url ? (
                      <a
                        className="production-action continue-production"
                        href={c.published_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Abrir vídeo
                      </a>
                    ) : status === "gravado" ? (
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
                        {status === "salvo" ? kit ? "Ver conteúdo" : "Criar conteúdo" : status === "publicado" ? "Ver roteiro" : "Continuar produção"}
                      </Link>
                    )}
                    {kit?.hook && (
                      <button className="production-action production-copy-hook" type="button" title="Copiar hook" aria-label="Copiar hook" onClick={() => copyHook(c)}>
                        ⧉
                      </button>
                    )}
                    {status === "publicado" && c.published_url && (
                      <Link
                        className="production-action production-script-link"
                        href={kit ? `/app/produtos/${c.product_id}/kits/${kit.id}` : `/app/produtos/${c.product_id}`}
                      >
                        Ver roteiro
                      </Link>
                    )}
                  </div>
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
        Publicar
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
    if (busy) return;
    const value = url.trim();
    if (value && !validTikTokUrl(value)) {
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
      track("published", { with_link: Boolean(value) });
      await loadProductions().catch(() => {});
      toast(value ? "Publicado ✓ Link salvo." : "Conteúdo marcado como publicado.");
    } catch {
      setError("Não conseguimos salvar a publicação. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} busy={busy} titleId="publication-dialog-title">
      <form className="stack" onSubmit={submit}>
        <button className="dialog-close" type="button" aria-label="Fechar" disabled={busy} onClick={onClose}>
          ×
        </button>
        <p className="eyebrow">Publicação</p>
        <h2 id="publication-dialog-title">Seu vídeo já foi publicado?</h2>
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
          {busy ? "Salvando..." : "Salvar publicação"}
        </button>
      </form>
    </Modal>
  );
}
