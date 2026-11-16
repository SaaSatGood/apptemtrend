"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Icon from "@/components/ui/Icon";
import { friendlyError } from "@/lib/api";
import { FALLBACK_IMAGE } from "@/lib/format";
import { usePlatform } from "../store";
import styles from "../Admin.module.css";
import { adminDownload, adminGet, adminPatch } from "./api";
import { formatCount, formatCurrency, formatPercent } from "./format";
import ProductEditor, { EMPTY_FORM, formFromProduct } from "./ProductEditor";
import type { AdminProduct, AdminProductPage, ProductFormState, ProductSort } from "./types";
import { EmptyState, ErrorState, LoadingRows, Pagination, SectionHeading } from "./ui";

const PAGE_SIZE = 25;

export default function ProductsTab({
  token,
  createSignal,
  onChanged,
}: {
  token?: string;
  createSignal: number;
  onChanged: () => void;
}) {
  const { toast } = usePlatform();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<ProductSort>("ranking");
  const [data, setData] = useState<AdminProductPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorForm, setEditorForm] = useState<ProductFormState>({ ...EMPTY_FORM });
  const [exporting, setExporting] = useState(false);
  const requestRef = useRef(0);

  // Busca com debounce: digitar não dispara uma request por tecla.
  useEffect(() => {
    const timer = window.setTimeout(() => { setQuery(search.trim()); setPage(1); }, 320);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    if (!token) return;
    const id = ++requestRef.current;
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), sort });
      if (query) params.set("q", query);
      if (status) params.set("status", status);
      if (category) params.set("categoria", category);
      const result = await adminGet<AdminProductPage>(`/admin/products?${params.toString()}`, token);
      if (id === requestRef.current) setData(result);
    } catch {
      if (id === requestRef.current) setError(true);
    } finally {
      if (id === requestRef.current) setLoading(false);
    }
  }, [category, page, query, sort, status, token]);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    adminGet<{ items: string[] }>("/admin/products/categories", token)
      .then((result) => { if (active) setCategories(result.items ?? []); })
      .catch(() => { if (active) setCategories([]); });
    return () => { active = false; };
  }, [token]);

  // Botão "Novo produto" do cabeçalho abre o editor nesta aba.
  useEffect(() => {
    if (createSignal > 0) openNew();
  }, [createSignal]);

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));
  const items = useMemo(() => data?.items ?? [], [data]);
  const hasFilters = Boolean(query || status || category);

  const summary = useMemo(() => {
    const ativos = items.filter((product) => product.status === "ativo").length;
    return { ativos, pausados: items.length - ativos };
  }, [items]);

  function openNew() {
    setEditingId(null);
    setEditorForm({ ...EMPTY_FORM });
    setEditorKey((key) => key + 1);
    setEditorOpen(true);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  async function openEditor(product: AdminProduct) {
    setBusyId(product.id);
    try {
      const detail = await adminGet<{ product: Record<string, unknown> }>(`/admin/products/${product.id}`, token);
      setEditorForm(formFromProduct(detail.product));
      setEditingId(product.id);
      setEditorKey((key) => key + 1);
      setEditorOpen(true);
      window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    } catch (err) {
      toast(friendlyError(err, "Não conseguimos abrir o produto."));
    } finally {
      setBusyId(null);
    }
  }

  async function toggleStatus(product: AdminProduct) {
    setBusyId(product.id);
    try {
      await adminPatch(`/admin/products/${product.id}`, { status: product.status === "ativo" ? "pausado" : "ativo" }, token);
      toast(product.status === "ativo" ? "Produto pausado." : "Produto ativado.");
      await load();
      onChanged();
    } catch (err) {
      toast(friendlyError(err, "Não conseguimos atualizar o produto."));
    } finally {
      setBusyId(null);
    }
  }

  async function exportCsv() {
    if (exporting) return;
    setExporting(true);
    try {
      const params = new URLSearchParams({ sort, page: "1", limit: String(PAGE_SIZE) });
      if (query) params.set("q", query);
      if (status) params.set("status", status);
      if (category) params.set("categoria", category);
      await adminDownload(
        `/admin/products/export?${params.toString()}`,
        `catalogo-temtrend-${new Date().toISOString().slice(0, 10)}.csv`,
        token,
      );
      toast("Exportação pronta.");
    } catch (err) {
      toast(friendlyError(err, "Não conseguimos exportar o catálogo."));
    } finally {
      setExporting(false);
    }
  }

  function clearFilters() {
    setSearch("");
    setQuery("");
    setStatus("");
    setCategory("");
    setPage(1);
  }

  return (
    <div className={styles.viewPanel}>
      <SectionHeading
        eyebrow="Catálogo"
        title="Produtos da plataforma"
        description="Encontre, revise e publique oportunidades para creators."
      />

      {editorOpen && (
        <ProductEditor
          key={editorKey}
          editingId={editingId}
          initialForm={editorForm}
          categories={categories}
          token={token}
          onClose={() => setEditorOpen(false)}
          onSaved={() => {
            setEditorOpen(false);
            void load();
            onChanged();
          }}
          onToast={toast}
        />
      )}

      <div className={`${styles.toolbar} ${styles.productsToolbar}`}>
        <label className={styles.searchField}>
          <Icon name="search" size={18} />
          <input
            aria-label="Buscar produtos"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar produto, loja, categoria ou ID"
          />
        </label>
        <select aria-label="Filtrar por status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
          <option value="">Todos os status</option>
          <option value="ativo">Ativos</option>
          <option value="pausado">Pausados</option>
        </select>
        <select aria-label="Filtrar por categoria" value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }}>
          <option value="">Todas as categorias</option>
          {categories.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select aria-label="Ordenar produtos" value={sort} onChange={(event) => { setSort(event.target.value as ProductSort); setPage(1); }}>
          <option value="ranking">Melhor ranking</option>
          <option value="vendas">Mais vendidos</option>
          <option value="receita">Maior receita</option>
          <option value="nome">Nome A–Z</option>
        </select>
        <button className={styles.iconButton} type="button" onClick={() => void exportCsv()} disabled={exporting || !data?.total}>
          <Icon name="download" size={16} />
          <span>{exporting ? "Gerando…" : "Exportar"}</span>
        </button>
      </div>

      <div className={styles.listMeta}>
        <p>
          <strong>{formatCount(data?.total ?? 0)}</strong> {data?.total === 1 ? "produto" : "produtos"}
          {hasFilters ? " com os filtros atuais" : " no catálogo"}
          {data ? ` · ${formatCount(summary.ativos)} ativos nesta página` : ""}
        </p>
        <button type="button" onClick={openNew}>
          <Icon name="plus" size={15} /> Adicionar produto
        </button>
      </div>

      {error && !data ? (
        <ErrorState message="Não foi possível carregar os produtos." onRetry={() => void load()} />
      ) : loading && !data ? (
        <LoadingRows count={6} />
      ) : items.length === 0 ? (
        <EmptyState
          title={hasFilters ? "Nenhum produto corresponde aos filtros." : "Catálogo vazio."}
          description={hasFilters ? "Ajuste a busca ou limpe os filtros para ver todo o catálogo." : "Cadastre o primeiro produto para liberar a descoberta."}
          action={hasFilters ? "Limpar filtros" : "Adicionar produto"}
          onAction={hasFilters ? clearFilters : openNew}
        />
      ) : (
        <div className={styles.productList} aria-busy={loading}>
          {items.map((product) => (
            <article key={product.id} className={styles.productRow}>
              <img
                src={product.imagem_url || FALLBACK_IMAGE}
                alt=""
                width={76}
                height={76}
                loading="lazy"
                onError={(event) => { event.currentTarget.src = FALLBACK_IMAGE; }}
              />
              <div className={styles.productIdentity}>
                <div className={styles.badges}>
                  <span className={product.status === "ativo" ? styles.statusActive : styles.statusPaused}>
                    {product.status === "ativo" ? "Ativo" : "Pausado"}
                  </span>
                  {product.destaque && <span className={styles.featuredBadge}>Destaque</span>}
                  {product.ranking_origem ? <span>#{product.ranking_origem}</span> : null}
                </div>
                <h3>{product.nome}</h3>
                <p>
                  {[product.loja_nome, product.categoria, product.produto_externo_id ? `ID ${product.produto_externo_id}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <dl className={styles.productStats}>
                <div><dt>Preço</dt><dd>{product.preco_texto || "—"}</dd></div>
                <div><dt>Vendas</dt><dd>{formatCount(product.unidades_vendidas_periodo, true)}</dd></div>
                <div>
                  <dt>Crescimento</dt>
                  <dd className={Number(product.crescimento_vendas_percentual) < 0 ? styles.negative : styles.positive}>
                    {formatPercent(product.crescimento_vendas_percentual)}
                  </dd>
                </div>
                <div><dt>Receita</dt><dd>{formatCurrency(product.receita_periodo_brl)}</dd></div>
              </dl>
              <div className={styles.rowActions}>
                {product.tiktok_shop_url && (
                  <a href={String(product.tiktok_shop_url)} target="_blank" rel="noreferrer" aria-label="Abrir produto no TikTok Shop">
                    <Icon name="external-link" size={14} />
                  </a>
                )}
                <button type="button" onClick={() => void openEditor(product)} disabled={busyId === product.id}>
                  <Icon name="pencil" size={14} /> Editar
                </button>
                <button
                  type="button"
                  className={product.status === "ativo" ? styles.pauseAction : styles.activateAction}
                  onClick={() => void toggleStatus(product)}
                  disabled={busyId === product.id}
                >
                  {busyId === product.id ? "Aguarde…" : product.status === "ativo" ? "Pausar" : "Ativar"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {data && data.total > PAGE_SIZE && (
        <Pagination
          page={page}
          totalPages={totalPages}
          onChange={setPage}
          total={data.total}
          label="produtos ·"
        />
      )}

      <p className={styles.paginationHint}>
        Exibindo {formatCount(items.length)} de {formatCount(data?.total ?? 0)}
        {summary.pausados > 0 ? ` · ${formatCount(summary.pausados)} pausados nesta página` : ""}
      </p>
    </div>
  );
}
