"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { api, friendlyError } from "@/lib/api";
import { FALLBACK_IMAGE, copyText, displayProductName, formatUpdated, normalizeScenes, type Scene } from "@/lib/format";
import type { ContentKit, Product } from "@/lib/types";
import { usePlatform } from "./store";
import { productionForProduct } from "./Assistant";

function factsOf(p: Product): string {
  return [
    p.produto_externo_id ? `ID ${p.produto_externo_id}` : null,
    p.preco_texto,
    p.comissao_percentual != null ? `${p.comissao_percentual}% comissão` : null,
    p.loja_nome,
  ]
    .filter(Boolean)
    .join(" · ");
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
  const { productions, toast, loadProductions } = usePlatform();
  const router = useRouter();
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
          <Link className="primary" href="/app">Voltar para produtos</Link>
        </div>
      </section>
    );
  }

  if (!detail) {
    return (
      <section className="detail-view" aria-live="polite">
        <div id="product-detail"><Skeletons /></div>
      </section>
    );
  }

  const { product, content_kits: kits } = detail;
  const production = productionForProduct(productions, product.id);
  const saved = Boolean(production?.content_kit_id);
  const name = displayProductName(product);

  function quickSave() {
    if (production?.content_kit_id) return;
    onNeedKit(product.id, "save", false);
  }

  function primaryAction() {
    if (!kits.length) {
      onNeedKit(product.id, "kit", false);
      return;
    }
    const existing = production?.content_kit_id
      ? kits.find((k) => k.id === production.content_kit_id) || null
      : null;
    if (existing) {
      if (production?.status === "salvo") void chooseKit(product, existing);
      else router.push(`/app/produtos/${product.id}/kits/${existing.id}`);
      return;
    }
    void chooseKit(product, kits[0]);
  }

  async function chooseKit(prod: Product, kit: ContentKit) {
    try {
      const { data } = await supabase().auth.getSession();
      const current = productionForProduct(productions, prod.id);
      if (!current) {
        await api("/creator-content", data.session?.access_token, {
          method: "POST",
          body: JSON.stringify({ content_kit_id: kit.id }),
        });
      } else if (!current.content_kit_id) {
        await api(`/creator-content/${current.id}/content-kit`, data.session?.access_token, {
          method: "POST",
          body: JSON.stringify({ content_kit_id: kit.id }),
        });
      }
      await loadProductions().catch(() => {});
      router.push(`/app/produtos/${prod.id}/kits/${kit.id}`);
      toast("Adicionado à sua produção. ✓");
    } catch (error) {
      toast(friendlyError(error, "Não conseguimos preparar este conteúdo. Tente novamente."));
    }
  }

  return (
    <section className="detail-view" aria-live="polite">
      <Link className="detail-back" href="/app">
        ← Voltar para produtos
      </Link>
      <div id="product-detail">
        <div className="product-detail-hero">
          <Image
            src={product.imagem_url || FALLBACK_IMAGE}
            alt={product.nome}
            width={800}
            height={600}
            onError={(e) => {
              (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
            }}
          />
          <div className="product-detail-copy">
            <span className="product-category">{product.categoria || "Produto"}</span>
            <h1>{product.nome}</h1>
            {factsOf(product) && <p className="product-facts">{factsOf(product)}</p>}
            <p>{product.descricao || "Use os dados confirmados do produto para gerar seu roteiro."}</p>
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
              <button className="ghost save-product" type="button" disabled={saved} onClick={quickSave}>
                {saved ? "Produto + Kit salvos ✓" : "Salvar produto + Content Kit"}
              </button>
              <button className="primary" type="button" onClick={primaryAction}>
                {!kits.length
                  ? "Criar Content Kit →"
                  : production?.content_kit_id && production.status !== "salvo"
                    ? "Ver Content Kit →"
                    : "Usar o Content Kit →"}
              </button>
              {kits.length > 0 && (
                <button className="ghost" type="button" onClick={() => onNeedKit(product.id, "kit", true)}>
                  Gerar outro roteiro ✦
                </button>
              )}
            </div>
            <p className="muted"><small>{name === product.nome ? "" : `Nome de exibição: ${name}`}</small></p>
          </div>
        </div>
        <section className="kits-section">
          <h2>Content Kits disponíveis</h2>
          <p>O roteiro existente é reutilizado. Gere outra abordagem somente quando precisar de uma nova versão.</p>
          <div className="kits-grid">
            {kits.length ? (
              kits.map((kit) => (
                <button key={kit.id} className="kit-card open-kit" type="button" onClick={() => void chooseKit(product, kit)}>
                  <div className="kit-meta">
                    {[kit.formato, kit.nivel_dificuldade, kit.duracao_seg ? `${kit.duracao_seg}s` : null]
                      .filter(Boolean)
                      .map((v) => (
                        <span key={String(v)}>{v}</span>
                      ))}
                  </div>
                  <h3>{kit.titulo}</h3>
                  <p>{kit.descricao || kit.hook || "Abra para ver o plano completo do vídeo."}</p>
                  <strong>Escolher Content Kit →</strong>
                </button>
              ))
            ) : (
              <div className="empty-state">
                <h3>Este produto ainda não possui um Content Kit.</h3>
                <p>A IA usará apenas as informações cadastradas para montar hook, roteiro, cenas, copy e CTA.</p>
                <button className="primary" type="button" onClick={() => onNeedKit(product.id, "kit", false)}>
                  Criar roteiro para este produto →
                </button>
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
  return { show: values.join(" · "), say: "", time: "", edit: "" };
}

export function KitDocument({ kit }: { kit: ContentKit }) {
  const scenes = normalizeScenes(kit.cenas);

  return (
    <article className="kit-document">
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
        <section className="kit-block hook-block">
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
        <section className="kit-block">
          <small>ROTEIRO POR CENAS</small>
          <div className="scene-list">
            {scenes.map((scene, index) => {
              const parts = sceneParts(scene);
              return (
                <article key={index} className="scene-card">
                  <strong>
                    CENA {String(index + 1).padStart(2, "0")}
                    {parts.time ? ` · ${parts.time}` : ""}
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
        <section className="kit-block">
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
        <section className="kit-block">
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
          <small>CTA</small>
          <p>{kit.cta}</p>
        </section>
      )}
      {kit.hashtags?.length ? (
        <section className="kit-block">
          <div className="block-heading">
            <small>HASHTAGS</small>
            <CopyButton id="copy-hashtags" text={(kit.hashtags || []).join(" ")} doneText="Hashtags copiadas ✓">
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
          <small>ÁUDIO SUGERIDO</small>
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
