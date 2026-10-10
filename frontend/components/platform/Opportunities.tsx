"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { Product } from "@/lib/types";
import { usePlatform } from "./store";
import { ProductCard, productionForProduct } from "./Assistant";
import { Skeletons } from "./ProductKit";

const FILTERS = ["Todos", "Mais vendidos", "Casa", "Beleza", "Fitness", "Tecnologia", "Até R$ 50"];
const CATALOG_CACHE_KEY = "temtrend_catalog_cache_v1";
const CATALOG_CACHE_TTL_MS = 10 * 60 * 1000;
const CATEGORY_TERMS: Record<string, RegExp> = {
  Casa: /casa|cozinha|domestic|decor|jardim|limpeza|organiz/,
  Beleza: /beleza|cabelo|cosmetic|cuidados|maquiagem|perfume/,
  Fitness: /fitness|esporte|academia/,
  Tecnologia: /tecnologia|eletronic|celular|informatica|acessorios digitais/,
};
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function Opportunities({ onOpen }: { onOpen: (id: string) => void }) {
  const { productions } = usePlatform();
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [filter, setFilter] = useState("Todos");
  const [limit, setLimit] = useState(12);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const raw = sessionStorage.getItem(CATALOG_CACHE_KEY);
        if (raw) {
          const cached = JSON.parse(raw) as { savedAt?: number; items?: Product[] };
          if (cached?.savedAt && Array.isArray(cached.items) && Date.now() - cached.savedAt < CATALOG_CACHE_TTL_MS) {
            setCatalog([...new Map(cached.items.map((p) => [p.id, p])).values()]);
            setLoading(false);
            return;
          }
        }
      } catch {
        /* Cache é opcional; segue para a rede. */
      }
      void (async () => {
        setLoading(true); setFailed(false);
        try {
          const { data } = await supabase().auth.getSession();
          const all: Product[] = [];
          for (let page = 1; active; page++) {
            const batch = await api<Product[]>(`/products?page=${page}&limit=50`, data.session?.access_token);
            all.push(...batch);
            if (batch.length < 50) break;
          }
          if (!active) return;
          const deduped = [...new Map(all.map((p) => [p.id, p])).values()];
          setCatalog(deduped);
          try {
            sessionStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), items: deduped }));
          } catch {
            /* Storage cheio ou indisponível; segue sem cache. */
          }
        } catch { if (active) setFailed(true); }
        finally { if (active) setLoading(false); }
      })();
    });
    return () => { active = false; };
  }, [retry]);

  const opportunities = useMemo(() => {
    let list = catalog;
    if (CATEGORY_TERMS[filter]) list = list.filter((p) => CATEGORY_TERMS[filter].test(normalize(p.categoria || "")));
    if (filter === "Até R$ 50") list = list.filter((p) => p.preco_min_brl != null && p.preco_min_brl <= 50);
    if (filter === "Mais vendidos") list = list.filter((p) => p.unidades_vendidas_periodo != null).sort((a, b) => b.unidades_vendidas_periodo! - a.unidades_vendidas_periodo!);
    return list;
  }, [catalog, filter]);
  const resume = [...productions].filter((p) => p.status !== "publicado").sort((a, b) => (b.atualizado_em || "").localeCompare(a.atualizado_em || "")).slice(0, 3);

  return <>
    {resume.length > 0 && <section className="resume-section">
      <div className="section-heading"><div><p className="eyebrow">Seu próximo passo</p><h2>Continue de onde parou</h2></div><Link className="text-button" href="/app/producao">Ver produção →</Link></div>
      <div className="resume-grid">{resume.map((item) => <Link key={item.id} className="resume-card" href={item.content_kit_id ? `/app/produtos/${item.product_id}/kits/${item.content_kit_id}` : `/app/produtos/${item.product_id}`}>
        <span className={`production-status status-${item.status}`}>{({ salvo: "Salvo", em_producao: "Em produção", gravado: "Gravado", publicado: "Publicado" })[item.status]}</span>
        <strong>{item.products?.nome || "Seu produto salvo"}</strong><span>Continuar →</span>
      </Link>)}</div>
    </section>}
    <section className="catalog-section" aria-label="Catálogo de oportunidades" aria-busy={loading}>
      <div className="section-heading"><div><p className="eyebrow">Encontre sua próxima ideia</p><h2>Explore <em>oportunidades.</em></h2><p>Algumas ideias para você começar.</p></div><span className="catalog-count" role="status">{!loading && !failed ? `${catalog.length} produtos no catálogo` : "Catálogo TemTrend"}</span></div>
      <div className="catalog-filters" role="group" aria-label="Filtrar oportunidades">{FILTERS.map((name) => <button type="button" key={name} aria-pressed={filter === name} onClick={() => { setFilter(name); setLimit(12); }}>{name}</button>)}</div>
      {filter === "Mais vendidos" && <p className="muted">Ordenados pelas vendas no período informado no catálogo.</p>}
      {filter === "Até R$ 50" && <p className="muted">Preço inicial de até R$ 50. Confira as variações no TikTok Shop.</p>}
      <div className="product-grid">{loading ? <Skeletons /> : failed ? <div className="empty-state"><h3>O catálogo não carregou.</h3><p>Tente novamente ou use a busca acima.</p><button className="ghost" type="button" onClick={() => setRetry((n) => n + 1)}>Tentar novamente</button></div> : opportunities.length ? opportunities.slice(0, limit).map((p) => <ProductCard key={p.id} product={p} saved={Boolean(productionForProduct(productions, p.id))} onOpen={onOpen} />) : <div className="empty-state"><h3>Nenhum produto neste filtro.</h3><p>Explore outras categorias para encontrar sua próxima ideia.</p><button className="ghost" type="button" onClick={() => setFilter("Todos")}>Ver todos os produtos</button></div>}</div>
      {!loading && !failed && opportunities.length > limit && <button className="ghost catalog-more" type="button" onClick={() => setLimit((n) => n + 12)}>Ver mais produtos ↓</button>}
    </section>
  </>;
}
