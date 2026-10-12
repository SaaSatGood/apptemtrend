"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { api, friendlyError } from "@/lib/api";
import { copyText, fullProductName, formatUpdated, normalizeScenes, type Scene } from "@/lib/format";
import type { ContentKit, Product } from "@/lib/types";
import { usePlatform } from "./store";
import { displayKitTitle, kitContext } from "./kit-presentation";
import { productionForProduct } from "./Assistant";
import ProductImage from "./ProductImage";
import EmphasizedTitle from "./EmphasizedTitle";

function factsOf(p: Product): string {
  const sold = p.unidades_vendidas_total ?? p.unidades_vendidas_periodo;
  return [
    p.produto_externo_id ? `ID ${p.produto_externo_id}` : null,
    p.preco_texto ? `Preço: ${p.preco_texto}` : null,
    sold != null ? `${sold.toLocaleString("pt-BR")} vendidos` : null,
    p.comissao_percentual != null ? `Comissão: ${p.comissao_percentual}%` : null,
    p.loja_nome,
  ]
    .filter(Boolean)
    .join(", ");
}

export function Skeletons() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div key={i} className="skeleton-card" aria-hidden="true">
          <div className="skeleton skeleton-image"></div>
          <div className="skeleton-lines">
            <span className="skeleton"></span>
            <span className="skeleton"></span>
            <span className="skeleton"></span>
          </div>
        </div>
      ))}
    </>
  );
}

export default function ProductDetail({ productId, onNeedKit }: { productId: string; onNeedKit: (productId: string, mode: "save" | "kit", forceNew: boolean) => void }) {
  const { productions, toast } = usePlatform();
  const [detail, setDetail] = useState<{ product: Product; content_kits: ContentKit[] } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase().auth.getSession();
        const loaded = await api<{ product: Product; content_kits: ContentKit[] }>(
          `/products/${productId}`,
          data.session?.access_token
        );
        if (!cancelled) setDetail(loaded);
      } catch (error) {
        if (!cancelled) {
          setFailed(true);
          toast(friendlyError(error, "Não conseguimos abrir este produto. Tente novamente."));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productId, toast]);

  if (failed) {
    return (
      <section className="detail-view" aria-live="polite">
        <div className="empty-state">
          <h3>Não conseguimos abrir este produto.</h3>
          <p>Tente novamente em alguns instantes.</p>
          <Link className="primary" href="/app">← Voltar para produtos</Link>
        </div>
      </section>
    );
  }

  if (!detail) {
    return (
      <section className="detail-view" aria-live="polite">
        <p role="status">Carregando dados do produto e seus roteiros…</p>
        <div id="product-detail"><Skeletons /></div>
      </section>
    );
  }

  const { product, content_kits: kits } = detail;
  const productName = fullProductName(product);
  const production = productionForProduct(productions, product.id);
  const saved = Boolean(production);
  const sold = product.unidades_vendidas_total ?? product.unidades_vendidas_periodo;

  function quickSave() {
    if (production) return;
    onNeedKit(product.id, "save", false);
  }

  function primaryAction() {
    onNeedKit(product.id, "kit", false);
  }

  return (
    <section className="detail-view" aria-live="polite">
      <nav className="detail-breadcrumb" aria-label="Navegação estrutural"><Link href="/app">Descobrir</Link><span>›</span><strong>Produto</strong></nav>
      <div id="product-detail">
        <div className="product-detail-hero">
          <ProductImage product={product} width={800} height={600} />
          <div className="product-detail-copy">
            {production && <span className="product-saved-badge">✓ Na sua produção: {({ salvo: "salvo", em_producao: "em produção", gravado: "gravado", publicado: "publicado" })[production.status]}, etapa {({ salvo: 1, em_producao: 2, gravado: 3, publicado: 4 })[production.status]} de 4</span>}
            <span className="product-category">{product.categoria || "Produto"}</span>
            <h1 className={productName.length > 64 ? "is-long-title" : ""} title={productName}><EmphasizedTitle text={productName} /></h1>
            <div className="product-detail-metrics" aria-label={factsOf(product)}>
              <div><span>Preço</span><strong>{product.preco_texto || "Não informado"}</strong></div>
              {sold != null && <div><span>Vendidos {product.unidades_vendidas_total == null ? "no período" : "no total"}</span><strong>{sold.toLocaleString("pt-BR")}</strong></div>}
              {product.comissao_percentual != null && <div><span>Comissão</span><strong>{product.comissao_percentual}%</strong></div>}
            </div>
            {product.descricao && <p>{product.descricao}</p>}
            {product.atualizado_em && (
              <p className="muted">
                <small>Dados do catálogo atualizados em {formatUpdated(product.atualizado_em)}.</small>
              </p>
            )}
            {product.tiktok_shop_url && (
              <a className="product-shop-link" href={product.tiktok_shop_url} target="_blank" rel="noopener noreferrer">
                Ver produto no TikTok Shop ↗
              </a>
            )}
            <div className="product-detail-primary">
              {kits.length ? <Link className="primary" href={`/app/produtos/${product.id}/kits/${kits.find((kit) => kit.id === production?.content_kit_id)?.id || kits[0].id}`}>Ver conteúdo →</Link> : <button className="primary" type="button" onClick={primaryAction}>Criar conteúdo →</button>}
              {!saved && <button className="ghost save-product" type="button" onClick={quickSave}>Salvar produto</button>}
              {kits.length > 0 && (
                <button className="ghost" type="button" onClick={() => onNeedKit(product.id, "kit", true)}>
                  Gerar outro conteúdo →
                </button>
              )}
            </div>
          </div>
        </div>
        <section className="kits-section">
          <div className="kits-section-heading">
            <div><p className="eyebrow">Da ideia à gravação</p><h2>Seus conteúdos</h2></div>
            <span>{kits.length} {kits.length === 1 ? "roteiro disponível" : "roteiros disponíveis"}</span>
          </div>
          {kits.length > 0 && <p>Use um roteiro existente ou gere outra abordagem quando quiser testar uma nova ideia.</p>}
          <div className="kits-grid">
            {kits.length ? (
              kits.map((kit) => (
                <Link key={kit.id} className="kit-card open-kit" href={`/app/produtos/${product.id}/kits/${kit.id}`}>
                  <div className="kit-meta">
                    {[kit.formato, kit.nivel_dificuldade, kit.duracao_seg ? `${kit.duracao_seg}s` : null]
                      .filter(Boolean)
                      .map((v) => (
                        <span key={String(v)}>{v}</span>
                      ))}
                  </div>
                  <h3>{displayKitTitle(kit, product)}</h3>
                  <p>{kitContext(kit, product).summary}</p>
                  {production?.content_kit_id === kit.id && <span className="kit-card-status">{({ salvo: "Salvo", em_producao: "Em produção", gravado: "Gravado", publicado: "Publicado" })[production.status]}</span>}
                  <strong>Abrir conteúdo →</strong>
                </Link>
              ))
            ) : (
              <div className="kit-empty-preview">
                <strong>Seu conteúdo vai trazer</strong>
                <div>{["Hook", "5 cenas", "Legenda", "Hashtags", "CTA"].map((item) => <span key={item}>{item}</span>)}</div>
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

function sceneParts(scene: Scene | string): { show: string; say: string; time: string; edit: string } {
  if (typeof scene === "string") return { show: scene, say: "", time: "", edit: "" };
  if (!scene || typeof scene !== "object") return { show: "", say: "", time: "", edit: "" };
  const s = scene as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : "");
  const show = str(s.mostre || s.visual || s.acao || s["ação"] || s.descricao || s["descrição"] || s.cena || s.title || s.titulo);
  const say = str(s.fale || s.fala || s.texto || s.script || s.narracao || s["narração"] || s.roteiro);
  const time = str(s.tempo || s.time || s.duracao || s["duração"]);
  const edit = str(s.acao_edicao || s.acaoEdicao || s.edicao || s["edição"]);
  if (show || say || time || edit) return { show, say, time, edit };
  const values = Object.values(s)
    .filter((v) => ["string", "number"].includes(typeof v))
    .map(String);
  return { show: values.join(", "), say: "", time: "", edit: "" };
}

export function KitDocument({ kit }: { kit: ContentKit }) {
  const scenes = normalizeScenes(kit.cenas);

  return (
    <article id="kit-document" className="kit-document">
      {kit.briefing_usuario && (
        <section className="kit-block">
          <small>SUAS ORIENTAÇÕES</small>
          <p className="preserve-lines">{kit.briefing_usuario}</p>
        </section>
      )}
      {kit.descricao && (
        <section className="kit-block">
          <small>BRIEFING RÁPIDO</small>
          <p className="preserve-lines">{kit.descricao}</p>
        </section>
      )}
      {kit.hook && (
        <section id="kit-hook" className="kit-block hook-block">
          <div className="block-heading">
            <small>HOOK</small>
            <CopyButton id="copy-hook" text={kit.hook} doneText="Hook copiado ✓">
              Copiar
            </CopyButton>
          </div>
          <h2>“{kit.hook}”</h2>
        </section>
      )}
      {scenes.length > 0 && (
        <section id="kit-cenas" className="kit-block">
          <div className="block-heading"><small>ROTEIRO POR CENAS</small><CopyButton id="copy-scenes" text={scenes.map((scene, index) => { const p = sceneParts(scene); return [`Cena ${index + 1}${p.time ? `: ${p.time}` : ""}`, p.show && `Mostre: ${p.show}`, p.say && `Fale: ${p.say}`, p.edit && `Ação / edição: ${p.edit}`].filter(Boolean).join("\n"); }).join("\n\n")} doneText="Copiado ✓">Copiar cenas</CopyButton></div>
          <div className="scene-list">
            {scenes.map((scene, index) => {
              const parts = sceneParts(scene);
              return (
                <article key={index} className="scene-card">
                  <strong>
                    CENA {String(index + 1).padStart(2, "0")}
                    {parts.time ? `: ${parts.time}` : ""}
                  </strong>
                  {parts.show && (
                    <div>
                      <small>MOSTRE</small>
                      <p>{parts.show}</p>
                    </div>
                  )}
                  {parts.say && (
                    <div>
                      <small>FALE</small>
                      <p>{parts.say}</p>
                    </div>
                  )}
                  {parts.edit && (
                    <div>
                      <small>AÇÃO / EDIÇÃO</small>
                      <p>{parts.edit}</p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}
      {kit.roteiro && (
        <section id="kit-roteiro" className="kit-block">
          <div className="block-heading">
            <small>ESTRATÉGIA COMPLETA + VARIAÇÕES</small>
            <CopyButton id="copy-roteiro" text={kit.roteiro} doneText="Roteiro copiado ✓">
              Copiar roteiro
            </CopyButton>
          </div>
          <p className="preserve-lines">{kit.roteiro}</p>
        </section>
      )}
      {kit.copy && (
        <section id="kit-legenda" className="kit-block">
          <div className="block-heading">
            <small>LEGENDA</small>
            <CopyButton id="copy-copy" text={kit.copy} doneText="Copy copiada ✓">
              Copiar legenda
            </CopyButton>
          </div>
          <p>{kit.copy}</p>
        </section>
      )}
      {kit.cta && (
        <section className="kit-block">
          <div className="block-heading"><small>CTA: CHAMADA PARA AÇÃO</small><CopyButton id="copy-cta" text={kit.cta} doneText="Copiado ✓">Copiar CTA</CopyButton></div>
          <p>{kit.cta}</p>
        </section>
      )}
      {kit.hashtags?.length ? (
        <section className="kit-block">
          <div className="block-heading">
            <small>HASHTAGS</small>
            <CopyButton id="copy-hashtags" text={(kit.hashtags || []).map((tag) => tag.startsWith("#") ? tag : `#${tag}`).join(" ")} doneText="Copiado ✓">
              Copiar hashtags
            </CopyButton>
          </div>
          <div className="hashtag-list">
            {kit.hashtags.map((tag) => (
              <span key={tag}>{tag.startsWith("#") ? tag : `#${tag}`}</span>
            ))}
          </div>
        </section>
      ) : null}
      {kit.audio_sugerido && (
        <section className="kit-block">
          <div className="block-heading"><small>ÁUDIO SUGERIDO</small><CopyButton id="copy-audio" text={kit.audio_sugerido} doneText="Copiado ✓">Copiar sugestão</CopyButton></div>
          <p>{kit.audio_sugerido}</p>
        </section>
      )}
      {kit.duracao_seg ? (
        <section className="kit-block">
          <small>DURAÇÃO</small>
          <p>{kit.duracao_seg}s</p>
        </section>
      ) : null}
    </article>
  );
}

export function CopyButton({
  id,
  text,
  doneText,
  children,
}: {
  id: string;
  text: string;
  doneText: string;
  children: React.ReactNode;
}) {
  const { toast } = usePlatform();
  const [done, setDone] = useState(false);
  return (
    <button
      id={id}
      type="button"
      onClick={async () => {
        const ok = await copyText(text || "");
        if (!ok) {
          toast("Não conseguimos copiar. Tente novamente.");
          return;
        }
        setDone(true);
        setTimeout(() => setDone(false), 2200);
      }}
    >
      {done ? doneText : children}
    </button>
  );
}
