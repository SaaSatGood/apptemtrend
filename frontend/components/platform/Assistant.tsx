"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { api, friendlyError } from "@/lib/api";
import { FALLBACK_IMAGE, displayProductName } from "@/lib/format";
import type { AssistantResponse, CreatorContent, Product } from "@/lib/types";
import { usePlatform } from "./store";
import Opportunities from "./Opportunities";

const EXAMPLES = [
  ["Produto para academia", "Quero vender produtos para academia"],
  ["Achadinho para casa", "Quero vender achadinhos úteis para a casa"],
  ["Produto de beleza", "Quero vender produtos de beleza"],
  ["Fácil de demonstrar", "Quero um produto fácil de demonstrar em vídeo"],
  ["Até R$ 50", "Quero produtos com preço de até 50 reais"],
  ["Para presentear", "Quero um produto para dar de presente"],
  ["Para iniciantes", "Quero encontrar meu primeiro produto para vender"],
  ["Para o TikTok", "Quero produtos para demonstrar em vídeos curtos no TikTok"],
];

const DISCOVERY_STATE_KEY = "temtrend_discovery_state";
const DISCOVERY_STATE_TTL = 2 * 60 * 60 * 1000;
const TOP_RESULTS = 5;
const PAGE_SIZE = 3;

function salesOf(product: Product): number {
  return product.unidades_vendidas_total ?? product.unidades_vendidas_periodo ?? -1;
}

export function ProductCard({
  product,
  saved,
  onOpen,
}: {
  product: Product;
  saved: boolean;
  onOpen: (id: string) => void;
}) {
  const name = displayProductName(product);
  return (
    <article className="product-card opportunity-card">
      <div className="product-image-wrap">
        <Image
          className="product-image"
          src={product.imagem_url || FALLBACK_IMAGE}
          alt={name}
          width={400}
          height={300}
          loading="lazy"
          unoptimized
          onError={(e) => {
            (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
          }}
        />
        {saved && <span className="catalog-saved">Salvo ✓</span>}
      </div>
      <div className="product-body">
        <span className="product-category">{product.categoria || "Produto"}</span>
        <h3 title={product.nome}>{name}</h3>
        {product.motivo && <p className="opportunity-motivo"><strong>Por que este:</strong> {product.motivo}</p>}
        <p className="opportunity-price">{product.preco_texto || "Preço não informado"}</p>
        <div className="product-actions">
          <button className="ghost open-product" type="button" aria-label={`Ver produto ${name}`} onClick={() => onOpen(product.id)}>
            Ver produto →
          </button>
        </div>
      </div>
    </article>
  );
}

export default function Assistant({ onOpen }: { onOpen: (id: string) => void }) {
  const { toast, productions, me } = usePlatform();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [message, setMessage] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [error, setError] = useState(false);
  const [contextIds, setContextIds] = useState<string[]>([]);
  const inFlight = useRef(false);
  const storageKey = `${DISCOVERY_STATE_KEY}:${me?.user_id}`;
  const interestShortcuts = [...new Set(me?.creator?.temas_interesse || [])]
    .filter((theme) => theme !== "Outros")
    .slice(0, 3);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const saved = JSON.parse(sessionStorage.getItem(storageKey) || "null") as {
          savedAt?: number;
          query?: string;
          message?: string;
          results?: Product[];
          contextIds?: string[];
        } | null;
        if (!saved?.savedAt || Date.now() - saved.savedAt > DISCOVERY_STATE_TTL) {
          sessionStorage.removeItem(storageKey);
        } else if (saved.query && saved.message && Array.isArray(saved.results)) {
          setQuery(saved.query);
          setMessage(saved.message);
          setResults(saved.results);
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
  }, [storageKey]);

  const topResults = useMemo(
    () => [...results].sort((a, b) => salesOf(b) - salesOf(a)).slice(0, TOP_RESULTS),
    [results]
  );
  const visibleResults = topResults.slice(0, visibleCount);

  const savedFor = (id: string) =>
    Boolean(
      productions.find((item) => item.product_id === id || item.products?.id === id)
        ?.content_kit_id
    );

  async function search(text: string, fresh = false) {
    if (inFlight.current) return;
    const trimmed = text.trim();
    if (trimmed.length < 3) {
      setSearched(true);
      setMessage("Descreva com pelo menos 3 caracteres o produto que você procura.");
      setResults([]);
      setVisibleCount(PAGE_SIZE);
      return;
    }
    inFlight.current = true;
    setSearching(true);
    setQuery(trimmed);
    setSearched(true);
    setError(false);
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
      setVisibleCount(PAGE_SIZE);
      try { sessionStorage.setItem(storageKey, JSON.stringify({
        savedAt: Date.now(),
        query: trimmed,
        message: result.message || "Nenhum produto encontrado.",
        results: list,
        contextIds: list.map((product) => product.id),
      })); } catch { /* Storage is optional. */ }
    } catch (err) {
      setError(true);
      setResults([]);
      setVisibleCount(PAGE_SIZE);
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
    setVisibleCount(PAGE_SIZE);
    setMessage("");
    setError(false);
  }

  return (
    <section id="assistant-section" className="dashboard-hero assistant-hero discovery-workspace" aria-labelledby="dashboard-title">
      <div className="discovery-hero">
      <div className="discover-intro">
        <p className="eyebrow">Da ideia ao seu próximo vídeo</p>
        <h1 id="dashboard-title">Descubra o que vale<br />a pena <em>vender.</em></h1>
        <p>Diga o que você procura ou deixe a TemTrend encontrar uma oportunidade para você.</p>
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
          <span className="search-shortcut" aria-label="Atalho: barra">/</span>
        </label>
        <div className="assistant-input-row">
          <input
            id="assistant-input"
            type="text"
            minLength={3}
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
        </div>
      </form>
      {interestShortcuts.length > 0 && (
        <div className="assistant-interest-shortcuts" role="group" aria-label="Buscas dos seus interesses">
          <span>Para você:</span>
          {interestShortcuts.map((theme) => (
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
          ))}
        </div>
      )}
      <div className="assistant-examples" role="group" aria-label="Exemplos de busca">
        <span>Experimente:</span>
        {EXAMPLES.map(([label, text]) => (
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
      <button className="text-button discovery-surprise" type="button" disabled={searching} onClick={() => void search("Não sei o que vender. Sugira oportunidades do catálogo para começar a criar conteúdo.", true)}>Não sei o que vender →</button>
      <p className="discovery-note">Produtos reais. Você escolhe a oportunidade, a TemTrend ajuda com o roteiro.</p>
      </div>
      {!searched && <Opportunities />}
      {searched && (
        <div className="assistant-response" aria-live="polite" aria-busy={searching}>
          <div className="assistant-message">
            <span className="assistant-mark" aria-hidden="true">T</span>
            <p>{message}</p>
            <button className="text-button" type="button" disabled={searching} onClick={reset}>
              Voltar a explorar
            </button>
          </div>
          {!searching && topResults.length > 0 && (
            <div className="discover-results-heading">
              <div>
                <span>Top {topResults.length} mais vendidos</span>
                <h2>Compare e escolha seu produto</h2>
              </div>
              <small>Dados do catálogo TemTrend</small>
            </div>
          )}
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
              visibleResults.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  saved={savedFor(p.id)}
                  onOpen={onOpen}
                />
              ))
            ) : (
              <div className="empty-state">
                <h3>{error ? "Tente novamente." : "Nenhum produto encontrado."}</h3>
                <p>
                  {error
                    ? "Toque em tentar novamente para refazer a solicitação."
                    : "Simplifique sua busca ou tente outra ideia."}
                </p>
                <button
                  className="primary"
                  type="button"
                  onClick={() => (error ? search(query) : reset())}
                >
                  {error ? "Tentar novamente" : "Nova busca"}
                </button>
              </div>
            )}
          </div>
          {!searching && !error && visibleCount < topResults.length && (
            <button
              className="ghost catalog-more"
              type="button"
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            >
              Mostrar mais ({topResults.length - visibleCount} restantes) ↓
            </button>
          )}
        </div>
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
