"use client";

import { useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { api, friendlyError } from "@/lib/api";
import { FALLBACK_IMAGE, displayProductName } from "@/lib/format";
import type { AssistantResponse, CreatorContent, Product } from "@/lib/types";
import { usePlatform } from "./store";

const EXAMPLES = [
  ["Produto para academia", "Quero vender produtos para academia"],
  ["Achadinho para casa", "Quero vender achadinhos úteis para a casa"],
  ["Produto de beleza", "Quero vender produtos de beleza"],
  ["Fácil de demonstrar", "Quero um produto fácil de demonstrar em vídeo"],
];

function productFacts(p: Product): string {
  return [
    p.produto_externo_id ? `ID ${p.produto_externo_id}` : null,
    p.preco_texto,
    p.comissao_percentual != null ? `${p.comissao_percentual}% comissão` : null,
    p.loja_nome,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function ProductCard({
  product,
  saved,
  onOpen,
  onSave,
}: {
  product: Product;
  saved: boolean;
  onOpen: (id: string) => void;
  onSave: (id: string) => void;
}) {
  const name = displayProductName(product);
  return (
    <article className="product-card">
      <div className="product-image-wrap">
        <Image
          className="product-image"
          src={product.imagem_url || FALLBACK_IMAGE}
          alt={name}
          width={400}
          height={300}
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
          }}
        />
      </div>
      <div className="product-body">
        <span className="product-category">{product.categoria || "Produto"}</span>
        <h3>{name}</h3>
        {productFacts(product) && <p className="product-facts">{productFacts(product)}</p>}
        <p>{product.descricao || "Abra para gerar informações e um roteiro com os dados deste produto."}</p>
        {product.tiktok_shop_url && (
          <a className="product-shop-link" href={product.tiktok_shop_url} target="_blank" rel="noopener noreferrer">
            Ver no TikTok Shop ↗
          </a>
        )}
        <div className="product-actions">
          <button className="primary open-product" type="button" aria-label={`Ver produto ${name}`} onClick={() => onOpen(product.id)}>
            Ver produto →
          </button>
          <button className="ghost save-product" type="button" disabled={saved} onClick={() => onSave(product.id)}>
            {saved ? "Produto + Kit salvos ✓" : "Salvar + Content Kit"}
          </button>
        </div>
      </div>
    </article>
  );
}

export default function Assistant({ onOpen, onNeedKit }: { onOpen: (id: string) => void; onNeedKit: (productId: string, mode: "save" | "kit", forceNew: boolean) => void }) {
  const { toast, productions } = usePlatform();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [message, setMessage] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [error, setError] = useState(false);
  const [contextIds, setContextIds] = useState<string[]>([]);

  const savedFor = (id: string) =>
    Boolean(
      productions.find((item) => item.product_id === id || item.products?.id === id)
        ?.content_kit_id
    );

  async function search(text: string) {
    const trimmed = text.trim();
    if (trimmed.length < 3) {
      setSearched(true);
      setMessage("Descreva com pelo menos 3 caracteres o produto que você procura.");
      setResults([]);
      return;
    }
    setSearching(true);
    setSearched(true);
    setError(false);
    setMessage("A IA está procurando no catálogo...");
    const slow = setTimeout(() => {
      setMessage("Estou conferindo os produtos cadastrados. Isso pode levar alguns segundos.");
    }, 9000);
    try {
      const { data } = await supabase().auth.getSession();
      const payload: { message: string; product_ids?: string[] } = { message: trimmed };
      if (contextIds.length) payload.product_ids = contextIds;
      const result = await api<AssistantResponse>("/assistant/products", data.session?.access_token, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const list = Array.isArray(result.products) ? result.products : [];
      setContextIds(list.map((p) => p.id));
      setMessage(result.message || "Nenhum produto encontrado.");
      setResults(list);
    } catch (err) {
      setError(true);
      setMessage("Não conseguimos concluir sua busca agora.");
      toast(friendlyError(err, "Não conseguimos concluir sua busca agora."));
    } finally {
      clearTimeout(slow);
      setSearching(false);
    }
  }

  function reset() {
    setContextIds([]);
    setQuery("");
    setSearched(false);
    setResults([]);
    setMessage("");
    setError(false);
  }

  return (
    <section id="assistant-section" className="dashboard-hero assistant-hero" aria-labelledby="dashboard-title">
      <p className="eyebrow">COMECE A VENDER</p>
      <h1 id="dashboard-title">O que você quer vender?</h1>
      <p>Encontre produtos e transforme uma ideia em conteúdo pronto para gravar.</p>
      <form
        className="assistant-form"
        onSubmit={(e) => {
          e.preventDefault();
          search(query);
        }}
      >
        <label htmlFor="assistant-input">Descreva o produto ou tipo de conteúdo que você procura</label>
        <div className="assistant-input-row">
          <input
            id="assistant-input"
            type="text"
            minLength={3}
            maxLength={500}
            required
            autoComplete="off"
            placeholder="Ex.: Produto útil para gravar um vídeo de organização"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button id="assistant-submit" className="primary" type="submit" disabled={searching}>
            {searching ? "Buscando..." : "Buscar no catálogo →"}
          </button>
        </div>
      </form>
      <div className="assistant-examples" role="group" aria-label="Exemplos de busca">
        {EXAMPLES.map(([label, text]) => (
          <button
            key={label}
            type="button"
            onClick={() => {
              setQuery(text);
              setContextIds([]);
              search(text);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {searched && (
        <div className="assistant-response" aria-live="polite">
          <div className="assistant-message">
            <span className="assistant-mark" aria-hidden="true">T</span>
            <p>{message}</p>
            <button className="text-button" type="button" onClick={reset}>
              Nova conversa
            </button>
          </div>
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
            ) : results.length ? (
              results.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  saved={savedFor(p.id)}
                  onOpen={onOpen}
                  onSave={(id) => onNeedKit(id, "save", false)}
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
