"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/ui/Icon";
import { fullProductName, validTikTokUrl } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { api, friendlyError } from "@/lib/api";
import { track } from "@/lib/track";
import type { CreatorContent } from "@/lib/types";
import { usePlatform } from "./store";
import Modal from "./Modal";
import ProductImage from "./ProductImage";
type Sort = "recentes" | "comissao" | "vendas" | "preco";
type StatusFilter = "todos" | "salvo" | "em_producao";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function commissionValue(content: CreatorContent): number | null {
  const product = content.products;
  return product?.preco_min_brl != null && product.comissao_percentual != null
    ? product.preco_min_brl * product.comissao_percentual / 100
    : null;
}

function salesValue(content: CreatorContent): number {
  return content.products?.unidades_vendidas_total ?? content.products?.unidades_vendidas_periodo ?? -1;
}

export default function Production() {
  const { productions, productionsLoading, productionsError, loadProductions, toast } = usePlatform();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("recentes");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [removing, setRemoving] = useState<CreatorContent | null>(null);
  const [removingBusy, setRemovingBusy] = useState(false);
  const [removingError, setRemovingError] = useState("");

  const visible = useMemo(() => {
    const search = query.trim().toLocaleLowerCase("pt-BR");
    const unique = Array.from(new Map(productions.filter((item) => item.products).map((item) => [item.product_id, item])).values());
    const filtered = unique.filter((item) => {
      if (statusFilter !== "todos" && item.status !== statusFilter) return false;
      if (!search) return true;
      return [item.products?.nome, item.products?.categoria, item.products?.loja_nome]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("pt-BR").includes(search));
    });

    return filtered.sort((a, b) => {
      if (sort === "comissao") return (commissionValue(b) ?? -1) - (commissionValue(a) ?? -1);
      if (sort === "vendas") return salesValue(b) - salesValue(a);
      if (sort === "preco") return (a.products?.preco_min_brl ?? Number.MAX_SAFE_INTEGER) - (b.products?.preco_min_brl ?? Number.MAX_SAFE_INTEGER);
      return new Date(b.atualizado_em || 0).getTime() - new Date(a.atualizado_em || 0).getTime();
    });
  }, [productions, query, sort, statusFilter]);

  function findProduct() {
    router.push(`/descobrir?nova=${Date.now()}`);
  }

  async function confirmRemove() {
    if (!removing || removingBusy) return;
    setRemovingBusy(true);
    setRemovingError("");
    try {
      const { data } = await supabase().auth.getSession();
      await api(`/creator-content/${removing.id}`, data.session?.access_token, { method: "DELETE" });
      track("production_removed", { status: removing.status });
      await loadProductions();
      toast("Produto removido dos selecionados.");
      setRemoving(null);
    } catch (error) {
      setRemovingError(friendlyError(error, "Não conseguimos remover agora. Tente novamente."));
    } finally {
      setRemovingBusy(false);
    }
  }

  return (
    <section id="production-section" className="dashboard-section production-section">
      <div className="production-heading">
        <div>
          <h1>Meus <span className="tt-hl">conteúdos</span></h1>
          <p>Organize o que está pronto para gravar, publique e acompanhe sua produção.</p>
        </div>
        <button className="selected-products-discover" type="button" onClick={findProduct}>+ Novo conteúdo</button>
      </div>
      <div className="production-guide-strip">
        <span className="production-guide-icon" aria-hidden="true" />
        <p><strong>{visible[0]?.products ? fullProductName(visible[0].products) : "Nenhum conteúdo pendente"}</strong><span>{visible[0] ? "Próximo conteúdo da sua fila de gravação." : "Encontre um produto para começar."}</span></p>
        <button type="button" onClick={findProduct}>Gravar agora</button>
      </div>
      <div className="production-toolbar">
        <div className="production-controls">
          <label className="production-search">
            <span className="sr-only">Buscar nos produtos selecionados</span>
            <input
              name="production-search"
              type="search"
              autoComplete="off"
              placeholder="Buscar por produto, categoria ou loja…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query && (
              <button type="button" aria-label="Limpar busca" onClick={() => setQuery("")}><Icon name="x" size={16} /></button>
            )}
          </label>
          <label className="production-sort">
            <span className="sr-only">Ordenação</span>
            <select name="production-sort" value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
              <option value="recentes">Ordenar: mais recentes</option>
              <option value="comissao">Ordenar: maior comissão</option>
              <option value="vendas">Ordenar: mais vendidos</option>
              <option value="preco">Ordenar: menor preço</option>
            </select>
          </label>
        </div>
        <div className="production-toolbar-foot">
          <p className="selected-products-count"><strong>{visible.length}</strong> {visible.length === 1 ? "produto salvo" : "produtos salvos"}</p>
          <div className="production-status-filters" role="tablist" aria-label="Filtrar produtos por etapa">
            {([['todos', 'Todos'], ['salvo', 'Salvos'], ['em_producao', 'Em produção']] as const).map(([value, label]) => (
              <button key={value} type="button" role="tab" aria-selected={statusFilter === value} className={statusFilter === value ? "is-active" : ""} onClick={() => setStatusFilter(value)}>{label}</button>
            ))}
          </div>
        </div>
      </div>
      {!productionsLoading && productions.length > 0 && (
        <div className="production-results-bar" aria-live="polite">
          <p>
            <strong>{visible.length}</strong> {visible.length === 1 ? "produto" : "produtos"}
            {query.trim() || statusFilter !== "todos" ? visible.length === 1 ? " encontrado" : " encontrados" : " selecionados"}
          </p>
          {query.trim() && (
            <button type="button" onClick={() => setQuery("")}>
              Limpar busca
            </button>
          )}
        </div>
      )}
      <div id="my-content" className="production-grid">
        {productionsError ? <div className="empty-state" role="alert"><p className="tt-dash-empty-kicker">Sem conexão</p><h3>Não conseguimos atualizar seus produtos.</h3><p>Sua seleção continua salva. Tente carregar novamente.</p><button className="ghost" type="button" disabled={productionsLoading} onClick={() => void loadProductions().catch(() => {})}>{productionsLoading ? "Carregando…" : "Tentar novamente"}</button></div> : productionsLoading && !productions.length ? (
          <><p className="production-loading-status" role="status">Carregando seus produtos…</p>{[0, 1, 2].map((item) => (
            <div key={item} className="production-card production-skeleton" aria-hidden="true">
              <div className="skeleton production-skeleton-image" />
              <div className="skeleton-lines"><span className="skeleton" /><span className="skeleton" /><span className="skeleton" /></div>
            </div>
          ))}</>
        ) : !productions.length ? (
          <div className="empty-state">
            <p className="tt-dash-empty-kicker">Primeiro passo</p>
            <h3>Você ainda não selecionou nenhum produto.</h3>
            <p>Encontre uma oportunidade e salve o primeiro produto que deseja transformar em conteúdo.</p>
            <button className="ghost" type="button" onClick={findProduct}>
              Encontrar produto
            </button>
          </div>
        ) : !visible.length ? (
          <div className="empty-state">
            <p className="tt-dash-empty-kicker">Nada por aqui</p>
            <h3>Nenhum produto encontrado.</h3>
            <p>Tente outro nome, categoria ou loja.</p>
            <button className="ghost" type="button" onClick={() => setQuery("")}>Ver todos</button>
          </div>
        ) : (
          visible.map((c) => {
            const product = c.products!;
            const commission = commissionValue(c);
            const sold = salesValue(c);
            return (
              <article key={c.id} className="production-card">
                <div className="production-image-wrap">
                  <ProductImage product={product} width={180} height={180} />
                </div>
                <div className="production-info">
                  <div className="production-card-topline">
                    <span className="product-category">{product.categoria || "Produto"}</span>
                    {product.loja_nome && <small>{product.loja_nome}</small>}
                  </div>
                  <h3 title={fullProductName(product)}>{fullProductName(product)}</h3>
                  <dl className="selected-product-metrics">
                    <div><dt>Preço</dt><dd>{product.preco_texto || (product.preco_min_brl != null ? BRL.format(product.preco_min_brl) : "Não informado")}</dd></div>
                    <div className="selected-product-commission"><dt>Comissão por venda</dt><dd>{commission != null ? BRL.format(commission) : "Não informada"}{product.comissao_percentual != null && <small>{product.comissao_percentual}%</small>}</dd></div>
                    <div><dt>Vendas</dt><dd>{sold >= 0 ? sold.toLocaleString("pt-BR") : "Não informado"}</dd></div>
                  </dl>
                  <div className="production-card-actions">
                    <Link className="production-action continue-production" href={`/produtos/${product.id}`}>
                      Gravar
                    </Link>
                    <button
                      className="production-action production-remove"
                      type="button"
                      title="Remover dos selecionados"
                      aria-label={`Remover ${fullProductName(product)} dos produtos selecionados`}
                      onClick={() => { setRemovingError(""); setRemoving(c); }}
                    >
                      •••
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
      {removing && (
        <Modal titleId="remove-production-title" busy={removingBusy} onClose={() => setRemoving(null)}>
          <div className="stack">
            <p className="eyebrow">Remover produto</p>
            <h2 id="remove-production-title">Remover dos selecionados?</h2>
            <p className="muted">
              <b>{removing.products?.nome || "Este produto"}</b> sai de Produtos selecionados e deixa de aparecer no painel.
              O produto do catálogo continua disponível e você pode salvá-lo de novo quando quiser.
            </p>
            {removingError && <p className="form-message error" role="alert">{removingError}</p>}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="danger-button" type="button" disabled={removingBusy} onClick={confirmRemove}>
                {removingBusy ? "Removendo..." : "Remover produto"}
              </button>
              <button className="ghost" type="button" disabled={removingBusy} onClick={() => setRemoving(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
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
      toast(value ? "Publicado. Link salvo." : "Conteúdo marcado como publicado.");
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
          <Icon name="x" size={18} />
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
            name="published-url"
            type="url"
            autoComplete="url"
            inputMode="url"
            placeholder="https://www.tiktok.com/@usuario/video/…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
        {error && <p className="form-message error" role="alert">{error}</p>}
        <button className="primary" type="submit" disabled={busy}>
          {busy ? "Salvando…" : "Salvar publicação"}
        </button>
      </form>
    </Modal>
  );
}
