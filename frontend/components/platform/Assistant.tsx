"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { api, friendlyError } from "@/lib/api";
import { displayProductName } from "@/lib/format";
import type { AssistantResponse, CreatorContent, Product } from "@/lib/types";
import { usePlatform } from "./store";
import Opportunities from "./Opportunities";
import ContentKitDialog from "./ContentKitDialog";
import ProductImage from "./ProductImage";

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

export function ProductCard({
  product,
  saved,
  saving,
  highlightLabel,
  onOpen,
  onSave,
  onGenerate,
}: {
  product: Product;
  saved: boolean;
  saving: boolean;
  highlightLabel?: string;
  onOpen: (id: string) => void;
  onSave: (id: string) => void;
  onGenerate: (id: string) => void;
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
        {product.motivo && <p className="opportunity-motivo"><strong>Por que este:</strong> {product.motivo}</p>}
        {isSensitive(product) && <p className="opportunity-sensitive">Pode ter restrição de anúncio ou criativo no TikTok.</p>}
        <dl className="opportunity-metrics">
          <div><dt>Preço</dt><dd>{product.preco_texto || (product.preco_min_brl != null ? BRL.format(product.preco_min_brl) : "Não informado")}</dd></div>
          <div><dt>Comissão / venda</dt><dd>{commission != null ? BRL.format(commission) : "Não informado"}{product.comissao_percentual != null && <small>{product.comissao_percentual}%{commission != null ? " do menor preço" : ""}</small>}</dd></div>
          <div><dt>Vendas</dt><dd>{sold >= 0 ? sold.toLocaleString("pt-BR") : "Não informado"}{sold >= 0 && <small>{product.unidades_vendidas_total != null ? "no total" : "no período"}</small>}</dd></div>
        </dl>
        <div className="product-actions">
          <div className="opportunity-secondary-actions">
            <button type="button" disabled={saved || saving} aria-label={`Salvar ${name}`} onClick={() => onSave(product.id)}>{saving ? "Salvando…" : saved ? "Salvo ✓" : "Salvar"}</button>
            <button className="generate-script" type="button" aria-label={`Gerar roteiro para ${name}`} onClick={() => onGenerate(product.id)}>Gerar roteiro ↗</button>
          </div>
          <button className="ghost open-product" type="button" aria-label={`Ver produto ${name}`} onClick={() => onOpen(product.id)}>Ver produto →</button>
        </div>
      </div>
    </article>
  );
}

export default function Assistant({ onOpen }: { onOpen: (id: string) => void }) {
  const router = useRouter();
  const params = useSearchParams();
  const landingSearch = params.get("search");
  const { toast, productions, me, session, loadProductions } = usePlatform();
  const [query, setQuery] = useState(() => (landingSearch || "").slice(0, 500));
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [message, setMessage] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [needsClarification, setNeedsClarification] = useState(false);
  const [error, setError] = useState(false);
  const [savingProductId, setSavingProductId] = useState<string | null>(null);
  const [kitProductId, setKitProductId] = useState<string | null>(null);
  const [contextIds, setContextIds] = useState<string[]>([]);
  const [hideSensitive, setHideSensitive] = useState(false);
  const hasPendingSearch = useRef(false);
  const inFlight = useRef(false);
  const scrollAfterSearch = useRef(false);
  const responseRef = useRef<HTMLDivElement>(null);
  const storageKey = `${DISCOVERY_STATE_KEY}:${me?.user_id}`;
  const interestShortcuts = [...new Set([...(me?.creator?.temas_interesse || []), ...productions.map((item) => item.products?.categoria || "")])]
    .filter((theme) => theme && theme !== "Outros")
    .slice(0, 2);
  const recurring = productions.length > 0;
  const inProgress = productions.filter((item) => item.status === "em_producao").length;
  const firstName = String((session?.user?.user_metadata?.full_name as string | undefined) || session?.user?.email?.split("@")[0] || "creator").trim().split(/\s+/)[0];

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

    const focusSearch = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key !== "/" || target?.matches("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      document.querySelector<HTMLInputElement>("#assistant-input")?.focus();
    };
    window.addEventListener("keydown", focusSearch);
    return () => {
      active = false;
      window.removeEventListener("keydown", focusSearch);
    };
  }, [storageKey, landingSearch]);

  const topResults = useMemo(() => results.filter((product) => !hideSensitive || !isSensitive(product)).slice(0, TOP_RESULTS), [results, hideSensitive]);
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
      try { sessionStorage.setItem(storageKey, JSON.stringify({
        savedAt: Date.now(),
        query: trimmed,
        message: result.message || "Nenhum produto encontrado.",
        results: list,
        needsClarification: Boolean(result.needs_clarification),
        contextIds: list.map((product) => product.id),
      })); } catch { /* Storage is optional. */ }
    } catch (err) {
      setError(true);
      setResults([]);
      setNeedsClarification(false);
      setMessage("Não conseguimos concluir sua busca agora.");
      toast(friendlyError(err, "Não conseguimos concluir sua busca agora."));
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
  }

  return (
    <section id="assistant-section" className={`dashboard-hero assistant-hero discovery-workspace${recurring || searched ? " is-compact" : ""}`} aria-labelledby="dashboard-title">
      {recurring && !searched && <Opportunities />}
      <div className="discovery-hero">
      <div className="discover-intro">
        <p className="eyebrow">Da ideia ao seu próximo vídeo</p>
        {recurring ? <><h1 id="dashboard-title">Olá, <em>{firstName || "creator"}.</em></h1><p>{inProgress > 0 ? `Você tem ${inProgress} ${inProgress === 1 ? "conteúdo em produção" : "conteúdos em produção"}.` : `${productions.length} ${productions.length === 1 ? "conteúdo" : "conteúdos"} na sua produção.`} Encontre a próxima ideia quando quiser.</p></> : <><h1 id="dashboard-title">Descubra o que vale<br />a pena <em>vender.</em></h1><p>Diga o que você procura ou deixe a TemTrend encontrar uma oportunidade para você.</p></>}
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
          <span className="search-shortcut" aria-label="Pressione barra para buscar" title="Pressione / para buscar">/</span>
        </label>
        <div className="assistant-input-row">
          <input
            id="assistant-input"
            type="text"
            minLength={2}
            maxLength={500}
            required
            autoComplete="off"
            placeholder="Ex.: Quero um produto barato para demonstrar em 15 segundos"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button id="assistant-submit" className="primary" type="submit" disabled={searching}>
            {searching ? "Encontrando produtos…" : "Encontrar produtos →"}
          </button>
          <button className="ghost discovery-surprise" type="button" disabled={searching} onClick={() => void search("Não sei o que vender. Sugira oportunidades do catálogo para começar a criar conteúdo.", true)}>{recurring ? "Me surpreenda" : "Não sei o que vender"}</button>
        </div>
      </form>
      <div className="assistant-shortcut-groups">
      {interestShortcuts.length > 0 && <div className="assistant-interest-shortcuts" role="group" aria-label="Buscas dos seus interesses"><span>Para você</span>{interestShortcuts.map((theme) => (
            <button
              key={theme}
              type="button"
              disabled={searching}
              onClick={() => {
                const text = `Quero vender produtos de ${theme.toLocaleLowerCase("pt-BR")} para criar vídeos`;
                setQuery(text);
                setContextIds([]);
                search(text, true);
              }}
            >
              {theme} <span aria-hidden="true">↗</span>
            </button>
          ))}</div>}
      <div className="assistant-examples" role="group" aria-label="Exemplos de busca">
        <span>Preço, nicho ou nível</span>
        {EXAMPLES.slice(0, interestShortcuts.length ? 4 : 5).map(([label, text]) => (
          <button
            key={label}
            type="button"
            disabled={searching}
            onClick={() => {
              setQuery(text);
              setContextIds([]);
              search(text, true);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      </div>
      <p className="discovery-note">Produtos reais. Você escolhe a oportunidade, a TemTrend ajuda com o roteiro.</p>
      </div>
      {!searched && !recurring && <Opportunities />}
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
                <button key={label} type="button" onClick={() => { setContextIds([]); void search(text, true); }}>{label} →</button>
              ))}
            </div>
          )}
          {!searching && topResults.length > 0 && (
            <div className="discover-results-heading">
              <div>
                <span>{topResults.length} {topResults.length === 1 ? "produto encontrado" : "produtos encontrados"}</span>
                <h2>{topResults.length === 1 ? "Conheça o produto encontrado" : "Compare e escolha seu produto"}</h2>
              </div>
              <small>Dados do catálogo TemTrend</small>
            </div>
          )}
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
                  onSave={(id) => void saveProduct(id)}
                  onGenerate={setKitProductId}
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
      {kitProductId && (
        <ContentKitDialog
          productId={kitProductId}
          mode="kit"
          forceNew={false}
          onClose={() => setKitProductId(null)}
          onCreated={(kit) => { setKitProductId(null); router.push(`/app/produtos/${kit.product_id}/kits/${kit.id}`); }}
        />
      )}
    </section>
  );
}

export function productionForProduct(
  productions: CreatorContent[],
  productId: string
): CreatorContent | null {
  return (
    productions.find((item) => item.product_id === productId || item.products?.id === productId) ||
    null
  );
}
