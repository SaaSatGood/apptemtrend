"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import Icon from "@/components/ui/Icon";
import { resolveSession, supabase } from "@/lib/supabase";
import { api, friendlyError } from "@/lib/api";
import { track } from "@/lib/track";
import { loadProductDetail, peekProductDetail } from "@/lib/product-detail-cache";
import { displayProductName } from "@/lib/format";
import type { AssistantResponse, DiscoverySearch, DiscoverySearchSummary, Product } from "@/lib/types";
import { usePlatform } from "./store";
import { productionForProduct } from "./production-helpers";
import ProductImage from "./ProductImage";
import UpgradeDialog from "./UpgradeDialog";
import HowItWorks from "./HowItWorks";
import { RecentSearches, SearchHistoryDialog } from "./DiscoveryHistory";

// Diálogo carregado sob demanda: fora do bundle inicial do Descobrir.
const ContentKitDialog = dynamic(() => import("./ContentKitDialog"), {
  loading: () => null,
});

const EXAMPLES = [
  ["Até R$ 50", "Quero produtos com preço de até 50 reais", "Preço"],
  ["Casa", "Quero vender produtos para casa", "Nicho"],
  ["Beleza", "Quero vender produtos de beleza", "Nicho"],
  ["Fácil de demonstrar", "Quero um produto fácil de demonstrar em vídeo", "Nível"],
  ["Para iniciantes", "Quero encontrar meu primeiro produto para vender", "Nível"],
] as const;

const DISCOVERY_STATE_KEY = "temtrend_discovery_state";
const DISCOVERY_STATE_TTL = 2 * 60 * 60 * 1000;
const TOP_RESULTS = 5;
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const CLARIFICATION_CHOICES = [
  ["Por preço", "Quero produtos com preço de até 50 reais"],
  ["Por nicho", "Quero vender produtos para casa"],
  ["Fáceis de gravar", "Quero produtos fáceis de demonstrar em vídeo"],
] as const;

function salesOf(product: Product): number {
  return product.unidades_vendidas_total ?? product.unidades_vendidas_periodo ?? -1;
}

function commissionOf(product: Product): number | null {
  return product.preco_min_brl != null && product.comissao_percentual != null
    ? product.preco_min_brl * product.comissao_percentual / 100
    : null;
}

function highlightFor(products: Product[]): { id: string; label: string } | null {
  if (products.length < 2) return null;
  const commissions = products
    .map((product) => ({ id: product.id, value: commissionOf(product) }))
    .filter((item): item is { id: string; value: number } => item.value !== null);
  if (commissions.length >= 2) {
    return { id: commissions.reduce((best, item) => item.value > best.value ? item : best).id, label: "Maior comissão estimada" };
  }
  const sales = products.filter((product) => salesOf(product) >= 0);
  if (sales.length >= 2) {
    return { id: sales.reduce((best, product) => salesOf(product) > salesOf(best) ? product : best).id, label: "Mais vendido do grupo" };
  }
  return null;
}

function isSensitive(product: Product): boolean {
  return /lingerie|camisola|moda íntima|moda intima|roupa íntima|roupa intima|adulto/i.test(`${product.categoria || ""} ${product.nome}`);
}

/** Guarda a última busca fora do escopo de render (o carimbo de tempo é impuro). */
function saveDiscoveryState(storageKey: string, snapshot: {
  query: string;
  message: string;
  results: Product[];
  needsClarification: boolean;
  contextIds: string[];
}) {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify({ savedAt: Date.now(), ...snapshot }));
  } catch { /* Storage is optional. */ }
}

function videoReason(reason?: string | null): string | null {
  if (!reason) return null;
  // TODO: pedir ao serviço uma justificativa própria para vídeo, sem repetir métricas do card.
  const cleaned = reason.split(" · ").filter((part) => !/preço acessível|comissão de|\d[\d.]* vendidos/i.test(part)).join(" · ").trim();
  return cleaned && !/^(selecionado para a sua busca|combina com sua busca)$/i.test(cleaned) ? cleaned : null;
}

export function ProductCard({
  product,
  saved,
  saving,
  highlightLabel,
  onOpen,
  onSave,
  onRemove,
  onGenerate,
  onPrefetch,
  compared = false,
  onCompare,
}: {
  product: Product;
  saved: boolean;
  saving: boolean;
  highlightLabel?: string;
  onOpen: (id: string) => void;
  onSave: (id: string) => void;
  onRemove?: (id: string) => void;
  onGenerate: (id: string) => void;
  onPrefetch?: (id: string) => void;
  compared?: boolean;
  onCompare?: (id: string) => void;
}) {
  const name = displayProductName(product);
  const commission = commissionOf(product);
  const sold = salesOf(product);
  return (
    <article className={`product-card opportunity-card${highlightLabel ? " is-featured" : ""}`}>
      <div className="product-image-wrap">
        <ProductImage product={product} className="product-image" />
        {highlightLabel && <span className="opportunity-highlight">{highlightLabel}</span>}
        {saved && <span className="catalog-saved">Salvo ✓</span>}
      </div>
      <div className="product-body">
        <span className="product-category">{product.categoria || "Produto"}</span>
        <h3 title={product.nome}>{name}</h3>
        {videoReason(product.motivo) && <p className="opportunity-motivo"><strong>Por que considerar</strong><span>{videoReason(product.motivo)}</span></p>}
        {isSensitive(product) && <p className="opportunity-sensitive">Pode ter restrição de anúncio ou criativo no TikTok.</p>}
        <dl className="opportunity-metrics">
          <div><dt>Preço</dt><dd>{product.preco_texto || (product.preco_min_brl != null ? BRL.format(product.preco_min_brl) : "Não informado")}</dd></div>
          {commission != null && <div><dt>Comissão estimada / venda</dt><dd>{BRL.format(commission)}{product.comissao_percentual != null && <small>{product.comissao_percentual}% do menor preço</small>}</dd></div>}
          <div><dt>Vendas</dt><dd>{sold >= 0 ? sold.toLocaleString("pt-BR") : "Não informado"}{sold >= 0 && <small>{product.unidades_vendidas_total != null ? "no total" : "no período"}</small>}</dd></div>
        </dl>
        {onCompare && <button className="opportunity-compare-toggle" type="button" aria-pressed={compared} onClick={() => onCompare(product.id)}>{compared ? "✓ Na comparação" : "Comparar produto"}</button>}
        <div className="product-actions">
          <div className="opportunity-secondary-actions">
            <button
              type="button"
              className={saved ? "is-saved" : ""}
              disabled={saving || (saved && !onRemove)}
              aria-label={saved ? `Remover ${name} dos salvos` : `Salvar ${name}`}
              onClick={() => (saved && onRemove ? onRemove(product.id) : onSave(product.id))}
            >
              {saving ? "Salvando…" : saved ? "Salvo ✓" : "Salvar"}
            </button>
            <button className="generate-script" type="button" aria-label={`Gerar roteiro para ${name}`} onClick={() => onGenerate(product.id)}>Gerar roteiro</button>
          </div>
          <button
            className="ghost open-product"
            type="button"
            aria-label={`Ver produto ${name}`}
            onPointerEnter={() => onPrefetch?.(product.id)}
            onFocus={() => onPrefetch?.(product.id)}
            onClick={() => onOpen(product.id)}
          >
            Ver produto
          </button>
        </div>
      </div>
    </article>
  );
}

export default function Assistant({ onOpen }: { onOpen: (id: string) => void }) {
  const router = useRouter();
  const params = useSearchParams();
  const landingSearch = params.get("search");
  const { toast, productions, me, loadProductions, session } = usePlatform();
  function prefetchProduct(id: string) {
    router.prefetch(`/app/produtos/${id}`);
    if (session?.access_token && !peekProductDetail(id)) {
      void loadProductDetail(id, session.access_token).catch(() => {});
    }
  }
  const [query, setQuery] = useState(() => (landingSearch || "").slice(0, 500));
  const [querySuggested, setQuerySuggested] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [message, setMessage] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [needsClarification, setNeedsClarification] = useState(false);
  const [error, setError] = useState(false);
  const [savingProductId, setSavingProductId] = useState<string | null>(null);
  const [kitProductId, setKitProductId] = useState<string | null>(null);
  const [planLimitMessage, setPlanLimitMessage] = useState("");
  const [contextIds, setContextIds] = useState<string[]>([]);
  const [hideSensitive, setHideSensitive] = useState(false);
  const [sortBy, setSortBy] = useState<"vendas" | "preco" | "comissao">("vendas");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [searchHistory, setSearchHistory] = useState<DiscoverySearchSummary[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyBusyId, setHistoryBusyId] = useState<string | null>(null);
  const [historyClearing, setHistoryClearing] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const historyRequestId = useRef(0);
  const hasPendingSearch = useRef(false);
  const inFlight = useRef(false);
  const scrollAfterSearch = useRef(false);
  const responseRef = useRef<HTMLDivElement>(null);
  const storageKey = `${DISCOVERY_STATE_KEY}:${me?.user_id}`;
  const recurring = productions.length > 0;

  useEffect(() => {
    let active = true;
    try {
      const pending = sessionStorage.getItem("temtrend_pending_search");
      if (pending) {
        hasPendingSearch.current = true;
        queueMicrotask(() => {
          if (!active) return;
          setQuery((current) => current || pending.slice(0, 500));
          sessionStorage.removeItem("temtrend_pending_search");
        });
      }
    } catch { /* armazenamento opcional */ }
    return () => { active = false; };
  }, []);

  useEffect(() => {
    try { const saved = localStorage.getItem("temtrend-hide-sensitive") === "true"; queueMicrotask(() => setHideSensitive(saved)); } catch { /* optional preference */ }
  }, []);

  useEffect(() => {
    if (!searching && searched && scrollAfterSearch.current) {
      scrollAfterSearch.current = false;
      responseRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [searching, searched, results]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      if (landingSearch || hasPendingSearch.current) return;
      try {
        const saved = JSON.parse(sessionStorage.getItem(storageKey) || "null") as {
          savedAt?: number;
          query?: string;
          message?: string;
          results?: Product[];
          needsClarification?: boolean;
          contextIds?: string[];
        } | null;
        if (!saved?.savedAt || Date.now() - saved.savedAt > DISCOVERY_STATE_TTL) {
          sessionStorage.removeItem(storageKey);
        } else if (saved.query && saved.message && Array.isArray(saved.results)) {
          setQuery(saved.query);
          setMessage(saved.message);
          setResults(saved.results);
          setNeedsClarification(Boolean(saved.needsClarification));
          setContextIds(Array.isArray(saved.contextIds) ? saved.contextIds : []);
          setSearched(true);
        }
      } catch {
        /* Storage is optional. */
      }
    });

    return () => {
      active = false;
    };
  }, [storageKey, landingSearch]);

  const refreshSearchHistory = useCallback(async () => {
    const requestId = ++historyRequestId.current;
    try {
      const session = await resolveSession();
      if (!session?.access_token) {
        if (requestId === historyRequestId.current) setSearchHistory([]);
        return;
      }
      const result = await api<{ items: DiscoverySearchSummary[] }>("/assistant/searches", session.access_token);
      if (requestId === historyRequestId.current) {
        setSearchHistory(Array.isArray(result.items) ? result.items : []);
      }
    } catch {
      // Histórico é um extra: se falhar, o Descobrir continua funcionando.
    }
  }, []);

  useEffect(() => {
    if (!me?.user_id) return;
    queueMicrotask(() => { void refreshSearchHistory(); });
  }, [me?.user_id, refreshSearchHistory]);

  const topResults = useMemo(() => results.filter((product) => !hideSensitive || !isSensitive(product)).slice(0, TOP_RESULTS).sort((a, b) => {
    if (sortBy === "preco") return (a.preco_min_brl ?? Infinity) - (b.preco_min_brl ?? Infinity);
    if (sortBy === "comissao") return (commissionOf(b) ?? -1) - (commissionOf(a) ?? -1);
    return salesOf(b) - salesOf(a);
  }), [results, hideSensitive, sortBy]);
  const comparedProducts = topResults.filter((product) => compareIds.includes(product.id));
  const highlight = useMemo(() => highlightFor(topResults), [topResults]);
  const clarificationChoices = /(?:facil|faceis|facilidade) de (?:gravar|demonstrar|mostrar)/.test(query.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase())
    ? CLARIFICATION_CHOICES.filter(([label]) => label !== "Fáceis de gravar")
    : CLARIFICATION_CHOICES;

  const savedFor = (id: string) =>
    Boolean(productionForProduct(productions, id));

  async function saveProduct(id: string) {
    if (savingProductId || savedFor(id)) return;
    setSavingProductId(id);
    try {
      const { data } = await supabase().auth.getSession();
      await api("/creator-content", data.session?.access_token, {
        method: "POST",
        body: JSON.stringify({ product_id: id }),
      });
      await loadProductions();
      toast("Produto salvo ✓ Encontre seu roteiro na área Produção.");
    } catch (err) {
      toast(friendlyError(err, "Não conseguimos salvar este produto. Tente novamente."));
    } finally {
      setSavingProductId(null);
    }
  }

  async function removeSaved(id: string) {
    if (savingProductId) return;
    const target = productions.find((item) => item.product_id === id);
    if (!target) return;
    setSavingProductId(id);
    try {
      const { data } = await supabase().auth.getSession();
      await api(`/creator-content/${target.id}`, data.session?.access_token, { method: "DELETE" });
      await loadProductions();
      track("saved_product_removed", { product_id: id });
      toast("Produto removido dos salvos.");
    } catch (err) {
      toast(friendlyError(err, "Não conseguimos remover este produto. Tente novamente."));
    } finally {
      setSavingProductId(null);
    }
  }

  async function search(text: string, fresh = false) {
    if (inFlight.current) return;
    const trimmed = text.trim();
    if (trimmed.length < 2) {
      setSearched(true);
      setMessage("Conte um pouco mais sobre o produto que você procura.");
      setResults([]);
      setNeedsClarification(true);
      return;
    }
    inFlight.current = true;
    setSearching(true);
    setQuery(trimmed);
    setSearched(true);
    scrollAfterSearch.current = true;
    setError(false);
    setNeedsClarification(false);
    setMessage("A IA está procurando no catálogo...");
    const slow = setTimeout(() => {
      setMessage("Estou conferindo os produtos cadastrados. Isso pode levar alguns segundos.");
    }, 9000);
    try {
      const { data } = await supabase().auth.getSession();
      const payload: { message: string; product_ids?: string[] } = { message: trimmed };
      if (!fresh && contextIds.length) payload.product_ids = contextIds;
      const result = await api<AssistantResponse>("/assistant/products", data.session?.access_token, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const list = Array.isArray(result.products) ? result.products : [];
      setContextIds(list.map((p) => p.id));
      setMessage(result.message || "Nenhum produto encontrado.");
      setResults(list);
      setNeedsClarification(Boolean(result.needs_clarification));
      track("search_performed", { q_len: trimmed.length, results: list.length, clarification: Boolean(result.needs_clarification) });
      saveDiscoveryState(storageKey, {
        query: trimmed,
        message: result.message || "Nenhum produto encontrado.",
        results: list,
        needsClarification: Boolean(result.needs_clarification),
        contextIds: list.map((product) => product.id),
      });
      void refreshSearchHistory();
    } catch (err) {
      const code = (err as { code?: string }).code;
      setError(true);
      setResults([]);
      setNeedsClarification(false);
      if (code === "PLAN_LIMIT") {
        // Limite do plano: intercepta no momento do valor com CTA de upgrade.
        const text = (err as Error).message || "Você atingiu o limite do seu plano.";
        setMessage(text);
        setPlanLimitMessage(text);
        track("upgrade_cta_view", { source: "assistant_limit" });
      } else {
        setMessage("Não conseguimos concluir sua busca agora.");
        toast(friendlyError(err, "Não conseguimos concluir sua busca agora."));
      }
    } finally {
      clearTimeout(slow);
      inFlight.current = false;
      setSearching(false);
    }
  }

  function reset() {
    try { sessionStorage.removeItem(storageKey); } catch { /* Storage is optional. */ }
    setContextIds([]);
    setSearched(false);
    setResults([]);
    setNeedsClarification(false);
    setMessage("");
    setError(false);
    setCompareIds([]);
    setQuerySuggested(false);
  }

  function toggleCompare(id: string) {
    setCompareIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current.slice(-1), id]);
  }

  async function openSavedSearch(id: string) {
    if (historyBusyId || historyClearing) return;
    setHistoryBusyId(id);
    setHistoryError("");
    try {
      const session = await resolveSession();
      const saved = await api<DiscoverySearch>(`/assistant/searches/${id}`, session?.access_token);
      const list = Array.isArray(saved.results) ? saved.results : [];
      const savedMessage = saved.message || "Nenhum produto encontrado.";
      const ids = Array.isArray(saved.context_ids) ? saved.context_ids : list.map((product) => product.id);
      setQuery(saved.query || "");
      setMessage(savedMessage);
      setResults(list);
      setNeedsClarification(Boolean(saved.needs_clarification));
      setContextIds(ids);
      setSearched(true);
      setError(false);
      setCompareIds([]);
      setQuerySuggested(false);
      saveDiscoveryState(storageKey, {
        query: saved.query || "",
        message: savedMessage,
        results: list,
        needsClarification: Boolean(saved.needs_clarification),
        contextIds: ids,
      });
      scrollAfterSearch.current = true;
      setHistoryOpen(false);
    } catch (err) {
      const failure = friendlyError(err, "Não conseguimos abrir esta busca. Tente novamente.");
      setHistoryError(failure);
      if (!historyOpen) toast(failure);
      void refreshSearchHistory();
    } finally {
      setHistoryBusyId(null);
    }
  }

  async function deleteSavedSearch(id: string) {
    if (historyBusyId || historyClearing) return;
    setHistoryBusyId(id);
    setHistoryError("");
    try {
      const session = await resolveSession();
      await api(`/assistant/searches/${id}`, session?.access_token, { method: "DELETE" });
      historyRequestId.current += 1;
      setSearchHistory((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      setHistoryError(friendlyError(err, "Não conseguimos remover esta busca. Tente novamente."));
    } finally {
      setHistoryBusyId(null);
    }
  }

  async function clearSavedSearches() {
    if (historyClearing) return;
    setHistoryClearing(true);
    setHistoryError("");
    try {
      const session = await resolveSession();
      await api("/assistant/searches", session?.access_token, { method: "DELETE" });
      historyRequestId.current += 1;
      setSearchHistory([]);
      toast("Histórico de buscas limpo.");
    } catch (err) {
      setHistoryError(friendlyError(err, "Não conseguimos limpar o histórico. Tente novamente."));
    } finally {
      setHistoryClearing(false);
    }
  }

  return (
    <section id="assistant-section" className={`dashboard-hero assistant-hero discovery-workspace${searched ? " is-compact" : ""}`} aria-labelledby="dashboard-title">
      <div className="assistant-shortcut-groups discovery-shortcuts">
      <div className="assistant-examples" role="group" aria-label="Exemplos de busca">
        <span>Preço, nicho ou nível</span>
        {EXAMPLES.map(([label, text]) => (
          <button
            key={label}
            type="button"
            disabled={searching}
            onClick={() => {
              setQuery(text);
              setQuerySuggested(true);
              setContextIds([]);
              search(text, true);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      </div>
      <div className="discovery-hero">
      <div className="discover-intro">
        <p className="eyebrow">Criar conteúdo</p>
        <h1 id="dashboard-title">Encontre seu produto.</h1>
        <p>Busque uma oportunidade, compare os dados e gere um roteiro pronto para gravar.</p>
      </div>
      <form
        className="assistant-form"
        onSubmit={(e) => {
          e.preventDefault();
          search(query);
        }}
      >
        <label htmlFor="assistant-input">
          O que você quer vender?
        </label>
        <div className="assistant-input-row">
          <span className="assistant-input-icon">
            <Icon name="search" size={17} />
          </span>
          <input
            id="assistant-input"
            type="text"
            minLength={2}
            maxLength={500}
            required
            autoComplete="off"
            placeholder="Ex.: produto barato para demonstrar em vídeo"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setQuerySuggested(false); }}
          />
        </div>
        <div className="assistant-actions">
          <button id="assistant-submit" className="primary" type="submit" disabled={searching}>
            {searching ? "Encontrando produtos…" : "Encontrar produtos"}
          </button>
          <button className="ghost discovery-surprise" type="button" disabled={searching} onClick={() => { setQuerySuggested(true); void search("Não sei o que vender. Sugira oportunidades do catálogo para começar a criar conteúdo.", true); }}>
            <span className="discovery-sparkle">
              <Icon name="sparkles" size={15} filled />
            </span>
            {recurring ? "Me surpreenda" : "Não sei o que vender"}
          </button>
        </div>
        {querySuggested && <p className="assistant-query-source">Busca sugerida pela TemTrend. Edite o texto para personalizar.</p>}
        <p className="discovery-note">
          <span className="discovery-check"><Icon name="check" size={15} /></span>
          Produtos reais. Você escolhe a oportunidade, a TemTrend ajuda com o roteiro.
        </p>
      </form>
      </div>
      {!searching && (
        <RecentSearches
          items={searchHistory}
          busyId={historyBusyId}
          onOpen={(id) => void openSavedSearch(id)}
          onShowAll={() => { setHistoryError(""); setHistoryOpen(true); }}
        />
      )}
      {!searched && <HowItWorks />}
      {searched && (
        <div className="assistant-response" ref={responseRef} aria-live="polite" aria-busy={searching}>
          <div className="assistant-message">
            <span className="assistant-mark" aria-hidden="true">T</span>
            <p>{hideSensitive && topResults.length < Math.min(results.length, TOP_RESULTS) ? `${message} ${topResults.length} de ${Math.min(results.length, TOP_RESULTS)} visíveis com seu filtro.` : message}</p>
            <button className="text-button" type="button" disabled={searching} onClick={reset}>
              Voltar a explorar
            </button>
          </div>
          {!searching && needsClarification && (
            <div className="assistant-clarification" role="group" aria-label="Escolha como buscar produtos">
              {clarificationChoices.map(([label, text]) => (
                <button key={label} type="button" onClick={() => { setContextIds([]); void search(text, true); }}>{label}</button>
              ))}
            </div>
          )}
          {!searching && topResults.length > 0 && (
            <div className="discover-results-heading">
              <div>
                <span>{topResults.length} {topResults.length === 1 ? "produto encontrado" : "produtos encontrados"}</span>
                <h2>{topResults.length === 1 ? "Conheça o produto encontrado" : "Compare e escolha seu produto"}</h2>
              </div>
              <div className="discover-results-tools"><small>Dados do catálogo TemTrend · ordenados por {sortBy === "vendas" ? "vendas" : sortBy === "preco" ? "menor preço" : "comissão estimada"}</small><label>Ordenar por <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)}><option value="vendas">Mais vendidos</option><option value="preco">Menor preço</option><option value="comissao">Maior comissão</option></select></label></div>
            </div>
          )}
          {!searching && comparedProducts.length === 2 && <div className="opportunity-comparison" aria-label="Comparação de produtos"><div className="opportunity-comparison-head"><strong>Comparar produtos</strong><button type="button" onClick={() => setCompareIds([])}>Limpar comparação</button></div><div className="opportunity-comparison-grid">{comparedProducts.map((product) => <div key={product.id}><strong>{displayProductName(product)}</strong><span>Preço: {product.preco_texto || (product.preco_min_brl != null ? BRL.format(product.preco_min_brl) : "—")}</span><span>Vendas: {salesOf(product) >= 0 ? salesOf(product).toLocaleString("pt-BR") : "—"}</span><span>Comissão estimada: {commissionOf(product) != null ? BRL.format(commissionOf(product)!) : "—"}</span><button type="button" onClick={() => onOpen(product.id)}>Ver produto</button></div>)}</div></div>}
          {!searching && results.some(isSensitive) && <label className="sensitive-filter"><input type="checkbox" checked={hideSensitive} onChange={(event) => { setHideSensitive(event.target.checked); try { localStorage.setItem("temtrend-hide-sensitive", String(event.target.checked)); } catch {} }} /> Ocultar categorias sensíveis</label>}
          <div className="product-grid">
            {searching ? (
              [0, 1, 2].map((i) => (
                <div key={i} className="skeleton-card" aria-hidden="true">
                  <div className="skeleton skeleton-image"></div>
                  <div className="skeleton-lines">
                    <span className="skeleton"></span>
                    <span className="skeleton"></span>
                    <span className="skeleton"></span>
                  </div>
                </div>
              ))
            ) : topResults.length ? (
              topResults.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  saved={savedFor(p.id)}
                  saving={savingProductId === p.id}
                  highlightLabel={highlight?.id === p.id ? highlight.label : undefined}
                  onOpen={onOpen}
                  onPrefetch={prefetchProduct}
                  onSave={(id) => void saveProduct(id)}
                  onRemove={(id) => void removeSaved(id)}
                  onGenerate={setKitProductId}
                  compared={compareIds.includes(p.id)}
                  onCompare={toggleCompare}
                />
              ))
            ) : needsClarification ? null : (
              <div className="empty-state">
                <h3>{error ? "Tente novamente." : "Nenhum produto encontrado."}</h3>
                <p>
                  {error
                    ? "Toque em tentar novamente para refazer a solicitação."
                    : "Simplifique sua busca ou tente outra ideia."}
                </p>
                <button
                  className="ghost"
                  type="button"
                  onClick={() => (error ? search(query) : reset())}
                >
                  {error ? "Tentar novamente" : "Nova busca"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {historyOpen && (
        <SearchHistoryDialog
          items={searchHistory}
          busyId={historyBusyId}
          clearing={historyClearing}
          error={historyError}
          onClose={() => setHistoryOpen(false)}
          onOpen={(id) => void openSavedSearch(id)}
          onDelete={(id) => void deleteSavedSearch(id)}
          onClear={() => void clearSavedSearches()}
        />
      )}
      {kitProductId && (
        <ContentKitDialog
          productId={kitProductId}
          product={results.find((product) => product.id === kitProductId)}
          mode="kit"
          forceNew={false}
          onClose={() => setKitProductId(null)}
          onCreated={(kit) => { setKitProductId(null); router.push(`/app/produtos/${kit.product_id}/kits/${kit.id}`); }}
        />
      )}
      {planLimitMessage && (
        <UpgradeDialog message={planLimitMessage} onClose={() => setPlanLimitMessage("")} />
      )}
    </section>
  );
}


