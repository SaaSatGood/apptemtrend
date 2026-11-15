"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Icon, { type IconName } from "@/components/ui/Icon";
import { api, friendlyError } from "@/lib/api";
import { primeProductDetail } from "@/lib/product-detail-cache";
import { resolveSession } from "@/lib/supabase";
import { notifyPlanUsageChanged } from "@/lib/usage-events";
import { fullProductName } from "@/lib/format";
import type { ContentKit, CreatorContent, Product } from "@/lib/types";
import { usePlatform } from "./store";
import { productionForProduct } from "./production-helpers";
import ProductImage from "./ProductImage";

type SortKey = "relevancia" | "vendas" | "comissao" | "preco" | "recentes";

type FilterOption = { value: string; label: string };

// Catálogo do creator: 12 produtos por vez. Cada "Carregar mais" revela mais 12.
// Sem filtro ativo, a vitrine é montada de um lote embaralhado, então a tela
// nunca abre com a mesma ordem — e o total do catálogo não é exposto.
const PAGE_SIZE = 12;
const SHUFFLE_FETCH_SIZE = 48;

/**
 * Select da plataforma: mesmo popup dos menus do app (superfície, borda,
 * sombra e item ativo em lime), no lugar do <select> nativo.
 */
function FilterSelect({
  label,
  icon,
  value,
  options,
  onChange,
  prefix = "",
}: {
  label: string;
  icon: IconName;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  prefix?: string;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const current = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) ref.current?.removeAttribute("open");
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !ref.current?.open) return;
      ref.current.open = false;
      ref.current.querySelector("summary")?.focus();
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  function select(next: string) {
    onChange(next);
    ref.current?.removeAttribute("open");
    ref.current?.querySelector("summary")?.focus();
  }

  return (
    <details className="prod-dd" ref={ref}>
      <summary className="prod-dd-trigger" aria-label={label}>
        <Icon name={icon} size={15} />
        <span>{prefix}{current?.label}</span>
        <Icon className="prod-dd-chevron" name="chevron-down" size={15} strokeWidth={2} />
      </summary>
      <div className="prod-dd-panel" role="listbox" aria-label={label}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={active}
              className={`prod-dd-option${active ? " is-active" : ""}`}
              onClick={() => select(option.value)}
            >
              <span>{option.label}</span>
              {active && <Icon name="check" size={15} />}
            </button>
          );
        })}
      </div>
    </details>
  );
}

const SORT_OPTIONS: FilterOption[] = [
  { value: "relevancia", label: "Relevância" },
  { value: "vendas", label: "Mais vendidos" },
  { value: "comissao", label: "Maior comissão" },
  { value: "preco", label: "Menor preço" },
  { value: "recentes", label: "Mais recentes" },
];

const PRICE_OPTIONS = [
  { value: 50, label: "Até R$ 50" },
  { value: 100, label: "Até R$ 100" },
  { value: 200, label: "Até R$ 200" },
];

const COMMISSION_OPTIONS = [
  { value: 10, label: "10%+" },
  { value: 20, label: "20%+" },
  { value: 30, label: "30%+" },
];

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function priceOf(product: Product): string {
  return product.preco_texto
    || (product.preco_min_brl != null ? BRL.format(product.preco_min_brl) : "Não informado");
}

function commissionOf(product: Product): number | null {
  const referencePrice = product.preco_min_brl ?? product.preco_max_brl;
  return referencePrice != null && product.comissao_percentual != null
    ? referencePrice * product.comissao_percentual / 100
    : null;
}

function salesOf(product: Product): number {
  return product.unidades_vendidas_total ?? product.unidades_vendidas_periodo ?? -1;
}

// Fisher-Yates: a vitrine sem filtro abre em ordem diferente a cada visita.
function shuffleProducts(list: Product[]): Product[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Produtos da plataforma: catálogo completo com busca, filtros e ordenação
 * no servidor. Cada card grava conteúdo (reaproveitando o roteiro do produto)
 * e permite salvar/remover dos selecionados.
 */
export default function ProductsView() {
  const { productions, loadProductions, toast } = usePlatform();
  const router = useRouter();

  const [items, setItems] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [categoria, setCategoria] = useState("");
  const [sort, setSort] = useState<SortKey>("relevancia");
  const [precoMax, setPrecoMax] = useState<number | null>(null);
  const [comissaoMin, setComissaoMin] = useState<number | null>(null);
  const [categorias, setCategorias] = useState<Array<{ categoria: string; total: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [busyProductId, setBusyProductId] = useState<string | null>(null);
  const [savingProductId, setSavingProductId] = useState<string | null>(null);
  const [optimisticSaved, setOptimisticSaved] = useState<Record<string, boolean>>({});
  const createdContentIds = useRef<Record<string, string>>({});
  const requestRef = useRef(0);
  // Sobra do lote embaralhado: evita novo request a cada "Carregar mais".
  const overflowRef = useRef<Product[]>([]);

  // Busca com respiro: só consulta o servidor depois que a digitação para.
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 350);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    (async () => {
      try {
        const session = await resolveSession();
        const result = await api<{ categorias: Array<{ categoria: string; total: number }> }>(
          "/products/categories",
          session?.access_token,
        );
        setCategorias(Array.isArray(result.categorias) ? result.categorias : []);
      } catch {
        // Sem as opções o select continua útil: só mostra "Todas".
      }
    })();
  }, []);

  const load = useCallback(async (targetPage: number, append: boolean) => {
    // "Sem filtro nenhum": busca, categoria, preço, comissão e ordenação no padrão.
    const shuffle = !(debouncedQuery.trim() || categoria || precoMax != null || comissaoMin != null || sort !== "relevancia");
    if (!append) overflowRef.current = [];

    // Ainda há sobra do lote embaralhado: revela sem bater no servidor.
    if (shuffle && append && overflowRef.current.length) {
      const next = overflowRef.current.splice(0, PAGE_SIZE);
      setItems((current) => [...current, ...next]);
      return;
    }

    const requestId = ++requestRef.current;
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(false);
    try {
      const session = await resolveSession();
      const fetchSize = shuffle ? SHUFFLE_FETCH_SIZE : PAGE_SIZE;
      const params = new URLSearchParams({ page: String(targetPage), limit: String(fetchSize), sort });
      if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());
      if (categoria) params.set("categoria", categoria);
      if (precoMax != null) params.set("preco_max", String(precoMax));
      if (comissaoMin != null) params.set("comissao_min", String(comissaoMin));
      const result = await api<{ items: Product[]; total: number }>(
        `/products/catalog?${params.toString()}`,
        session?.access_token,
      );
      if (requestId !== requestRef.current) return;
      let loaded = Array.isArray(result.items) ? result.items : [];
      if (shuffle) {
        // Embaralha o lote e guarda a sobra: a próxima abertura começa diferente.
        const shuffled = shuffleProducts(loaded);
        overflowRef.current = shuffled.slice(PAGE_SIZE);
        loaded = shuffled.slice(0, PAGE_SIZE);
      }
      setItems((current) => (append ? [...current, ...loaded] : loaded));
      // O total fica só como controle interno do "Carregar mais" — nunca na tela.
      setTotal(result.total ?? loaded.length);
      setPage(targetPage);
    } catch {
      if (requestId === requestRef.current) setError(true);
    } finally {
      if (requestId === requestRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [debouncedQuery, categoria, sort, precoMax, comissaoMin]);

  useEffect(() => {
    queueMicrotask(() => { void load(1, false); });
  }, [load]);

  function clearFilters() {
    setQuery("");
    setCategoria("");
    setSort("relevancia");
    setPrecoMax(null);
    setComissaoMin(null);
  }

  const hasFilters = Boolean(query.trim() || categoria || precoMax != null || comissaoMin != null || sort !== "relevancia");

  function savedFor(id: string): boolean {
    return optimisticSaved[id] ?? Boolean(productionForProduct(productions, id));
  }

  function setOptimistic(id: string, value: boolean) {
    setOptimisticSaved((current) => ({ ...current, [id]: value }));
  }

  async function record(product: Product) {
    if (busyProductId) return;
    setBusyProductId(product.id);
    try {
      const session = await resolveSession();
      const kit = (await api<{ content_kit: ContentKit }>(
        `/products/${product.id}/content-kit`,
        session?.access_token,
        {
          method: "POST",
          body: JSON.stringify({ force_new: false }),
          timeoutMs: 90_000,
        }
      )).content_kit;
      // Cache quente: a tela de gravação abre já com o roteiro preenchido.
      primeProductDetail(product, kit);
      notifyPlanUsageChanged();
      router.push(`/produtos/${product.id}/kits/${kit.id}`);
    } catch (error) {
      toast(friendlyError(error, "Não conseguimos abrir o roteiro. Tente novamente."));
    } finally {
      setBusyProductId(null);
    }
  }

  async function toggleSaved(product: Product) {
    if (savingProductId) return;
    const saved = savedFor(product.id);
    const contentId = createdContentIds.current[product.id] ?? productionForProduct(productions, product.id)?.id;
    setOptimistic(product.id, !saved);
    setSavingProductId(product.id);
    try {
      const session = await resolveSession();
      if (saved) {
        if (!contentId) throw new Error("sem conteúdo");
        await api(`/creator-content/${contentId}`, session?.access_token, { method: "DELETE" });
        delete createdContentIds.current[product.id];
        toast("Produto removido dos selecionados.");
      } else {
        const created = await api<CreatorContent>("/creator-content", session?.access_token, {
          method: "POST",
          body: JSON.stringify({ product_id: product.id }),
        });
        if (created?.id) createdContentIds.current[product.id] = created.id;
        toast("Produto salvo nos selecionados.");
      }
      void loadProductions();
    } catch (error) {
      setOptimistic(product.id, saved);
      toast(friendlyError(error, saved ? "Não conseguimos remover este produto. Tente novamente." : "Não conseguimos salvar este produto. Tente novamente."));
    } finally {
      setSavingProductId(null);
    }
  }

  const heading = useMemo(() => {
    if (loading) return "Carregando catálogo…";
    if (hasFilters) return "Resultados da sua busca";
    return "Produtos disponíveis para gravar";
  }, [loading, hasFilters]);

  const categoriaOptions = useMemo<FilterOption[]>(
    () => [
      { value: "", label: "Todas as categorias" },
      ...categorias.map((item) => ({ value: item.categoria, label: item.categoria })),
    ],
    [categorias],
  );

  return (
    <div className="prod-page">
      <header className="prod-head">
        <div>
          <p className="eyebrow">Catálogo TemTrend</p>
          <h1>Produtos da <span className="tt-hl">plataforma</span></h1>
          <p>Todos os produtos disponíveis para você transformar em conteúdo.</p>
        </div>
      </header>

      <div className="prod-toolbar">
        <label className="ct-search prod-search">
          <Icon name="search" size={15} />
          <input
            type="search"
            name="catalog-search"
            autoComplete="off"
            aria-label="Buscar produtos"
            placeholder="Buscar por nome, categoria ou loja…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button type="button" aria-label="Limpar busca" onClick={() => setQuery("")}>
              <Icon name="x" size={15} />
            </button>
          )}
        </label>

        <FilterSelect
          label="Categoria"
          icon="grid"
          value={categoria}
          options={categoriaOptions}
          onChange={setCategoria}
        />

        <FilterSelect
          label="Ordenação"
          icon="arrow-down"
          value={sort}
          options={SORT_OPTIONS}
          onChange={(value) => setSort(value as SortKey)}
          prefix="Ordenar: "
        />
      </div>

      <div className="prod-filter-row">
        <div className="prod-chips" role="group" aria-label="Filtrar por preço">
          <span>Preço</span>
          {PRICE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={precoMax === option.value ? "is-active" : undefined}
              aria-pressed={precoMax === option.value}
              onClick={() => setPrecoMax(precoMax === option.value ? null : option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="prod-chips" role="group" aria-label="Filtrar por comissão">
          <span>Comissão</span>
          {COMMISSION_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={comissaoMin === option.value ? "is-active" : undefined}
              aria-pressed={comissaoMin === option.value}
              onClick={() => setComissaoMin(comissaoMin === option.value ? null : option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        {hasFilters && (
          <button type="button" className="prod-clear" onClick={clearFilters}>
            Limpar filtros
          </button>
        )}
      </div>

      <div className="prod-results-bar" aria-live="polite">
        <p><strong>{heading}</strong></p>
      </div>

      {error ? (
        <div className="empty-state" role="alert">
          <h3>Não conseguimos carregar o catálogo.</h3>
          <p>Verifique sua conexão e tente novamente.</p>
          <button className="ghost" type="button" onClick={() => void load(1, false)}>Tentar novamente</button>
        </div>
      ) : loading ? (
        <div className="prod-grid" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <div key={index} className="prod-card prod-skeleton">
              <div className="skeleton prod-skeleton-media" />
              <div className="skeleton-lines">
                <span className="skeleton" />
                <span className="skeleton" />
                <span className="skeleton" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <h3>Nenhum produto encontrado.</h3>
          <p>Tente outro termo ou remova alguns filtros.</p>
          <button className="ghost" type="button" onClick={clearFilters}>Limpar filtros</button>
        </div>
      ) : (
        <>
          <div className="prod-grid">
            {items.map((product) => {
              const name = fullProductName(product);
              const saved = savedFor(product.id);
              const commission = commissionOf(product);
              const sold = salesOf(product);
              const busy = busyProductId === product.id;
              const saving = savingProductId === product.id;
              return (
                <article key={product.id} className="prod-card">
                  <Link className="prod-card-media" href={`/produtos/${product.id}`} aria-label={`Abrir ${name}`}>
                    <ProductImage product={product} width={400} height={300} />
                  </Link>
                  <div className="prod-card-body">
                    <div className="prod-card-top">
                      <span className="product-category">{product.categoria || "Produto"}</span>
                      {product.loja_nome && <small title={product.loja_nome}>{product.loja_nome}</small>}
                    </div>
                    <h3 title={name}>
                      <Link href={`/produtos/${product.id}`}>{name}</Link>
                    </h3>
                    <dl className="prod-metrics">
                      <div>
                        <dt>Preço</dt>
                        <dd>{priceOf(product)}</dd>
                      </div>
                      <div>
                        <dt>Comissão</dt>
                        <dd>
                          {product.comissao_percentual != null ? `${product.comissao_percentual}%` : "—"}
                          {commission != null && <small>~ {BRL.format(commission)} / venda</small>}
                        </dd>
                      </div>
                      <div>
                        <dt>Vendas</dt>
                        <dd>{sold >= 0 ? sold.toLocaleString("pt-BR") : "—"}</dd>
                      </div>
                    </dl>
                    <div className="prod-actions">
                      <button
                        type="button"
                        className="ct-btn-record is-solid"
                        disabled={busy}
                        aria-label={`Gravar conteúdo para ${name}`}
                        onClick={() => void record(product)}
                      >
                        {busy ? "Abrindo roteiro…" : "Gravar conteúdo"}
                      </button>
                      <button
                        type="button"
                        className={`prod-save${saved ? " is-saved" : ""}`}
                        disabled={saving}
                        aria-pressed={saved}
                        aria-label={saved ? `Remover ${name} dos selecionados` : `Salvar ${name} nos selecionados`}
                        title={saved ? "Remover dos selecionados" : "Salvar nos selecionados"}
                        onClick={() => void toggleSaved(product)}
                      >
                        <Icon name={saved ? "check" : "bookmark"} size={17} />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {items.length < total && (
            <div className="prod-more">
              <button
                type="button"
                className="ghost"
                disabled={loadingMore}
                onClick={() => void load(page + 1, true)}
              >
                {loadingMore ? "Carregando…" : "Carregar mais"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
