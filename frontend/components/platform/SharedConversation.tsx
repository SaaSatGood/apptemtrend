"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "@/components/ui/Icon";
import { api, friendlyError, type ApiError } from "@/lib/api";
import { copyText, displayProductName, fullProductName } from "@/lib/format";
import { resolveSession } from "@/lib/supabase";
import { primeProductDetail } from "@/lib/product-detail-cache";
import { notifyPlanUsageChanged } from "@/lib/usage-events";
import type { ContentKit, SharedConversation as SharedConversationData, SharedProduct, SharedTurn } from "@/lib/types";
import { usePlatform } from "./store";
import ProductImage from "./ProductImage";
import HighlightedTitle from "./HighlightedTitle";
import UpgradeDialog from "./UpgradeDialog";
import { KitDocument } from "./ProductKit";
import { displayKitTitle } from "./kit-presentation";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
type SharedView = "chat" | "roteiro";

function productFacts(product: SharedProduct): string {
  const sold = product.unidades_vendidas_total ?? product.unidades_vendidas_periodo;
  return [
    product.categoria,
    product.preco_texto || (product.preco_min_brl != null ? BRL.format(product.preco_min_brl) : null),
    sold != null ? `${sold.toLocaleString("pt-BR")} vendidos` : null,
    product.comissao_percentual != null ? `${product.comissao_percentual}% de comissão` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function chipPrice(product: SharedProduct): string {
  return product.preco_texto || (product.preco_min_brl != null ? BRL.format(product.preco_min_brl) : "Preço não informado");
}

/**
 * Conversa compartilhada do Descobrir. Quem recebe o link (sempre logado) escolhe
 * ver como chatbot ou como roteiro; o clique em qualquer produto abre a tela de
 * gravar conteúdo com o roteiro pronto para usar.
 */
export default function SharedConversation({ slug }: { slug: string }) {
  const router = useRouter();
  const { toast } = usePlatform();
  const [data, setData] = useState<SharedConversationData | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [view, setView] = useState<SharedView>("chat");
  const [busyProductId, setBusyProductId] = useState<string | null>(null);
  const [planLimitMessage, setPlanLimitMessage] = useState("");
  const [revokeAsk, setRevokeAsk] = useState(false);
  const [revoking, setRevoking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const session = await resolveSession();
        const conversation = await api<SharedConversationData>(`/share/conversations/${slug}`, session?.access_token);
        if (!cancelled) {
          setData(conversation);
          setFailed(null);
        }
      } catch (error) {
        if (cancelled) return;
        setFailed(friendlyError(error, "Não conseguimos abrir esta conversa. O link pode ter sido desativado."));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const products = useMemo(() => {
    const seen = new Map<string, SharedProduct>();
    for (const turn of data?.turns ?? []) {
      for (const product of turn.products) if (!seen.has(product.id)) seen.set(product.id, product);
    }
    return [...seen.values()];
  }, [data]);

  /** Clique no produto: leva o roteiro compartilhado para a tela de gravação. */
  const startRecording = useCallback(async (product: SharedProduct) => {
    if (busyProductId) return;
    setBusyProductId(product.id);
    try {
      const session = await resolveSession();
      const sharedKit = product.content_kits?.[0];
      // Com roteiro no link, o conteúdo é copiado (sem IA) para o workspace de
      // quem abriu; sem roteiro, a tela de gravação gera o primeiro.
      const kit = sharedKit
        ? (await api<{ content_kit: ContentKit }>(`/share/conversations/${slug}/import`, session?.access_token, {
          method: "POST",
          body: JSON.stringify({ product_id: product.id, content_kit_id: sharedKit.id }),
        })).content_kit
        : (await api<{ content_kit: ContentKit }>(`/products/${product.id}/content-kit`, session?.access_token, {
          method: "POST",
          body: JSON.stringify({ force_new: false }),
          timeoutMs: 90_000,
        })).content_kit;
      primeProductDetail(product, kit);
      notifyPlanUsageChanged();
      router.push(`/produtos/${product.id}/kits/${kit.id}`);
    } catch (error) {
      if ((error as ApiError).code === "PLAN_LIMIT") {
        setPlanLimitMessage((error as Error).message || "Você atingiu o limite do seu plano.");
      } else {
        toast(friendlyError(error, "Não conseguimos abrir a tela de gravação. Tente novamente."));
      }
      setBusyProductId(null);
    }
  }, [busyProductId, router, slug, toast]);

  async function copyShareLink() {
    const url = `${window.location.origin}/compartilhar/${slug}`;
    const copied = await copyText(url);
    toast(copied ? "Link copiado." : "Não foi possível copiar. Copie o endereço da página.");
  }

  async function revokeLink() {
    if (revoking) return;
    setRevoking(true);
    try {
      const session = await resolveSession();
      await api(`/share/conversations/${slug}`, session?.access_token, { method: "DELETE" });
      toast("Link desativado. Ninguém mais consegue abrir esta conversa.");
      router.push("/descobrir");
    } catch (error) {
      toast(friendlyError(error, "Não conseguimos desativar o link. Tente novamente."));
      setRevoking(false);
      setRevokeAsk(false);
    }
  }

  if (failed) {
    return (
      <section className="detail-view shared-view" aria-live="polite">
        <div className="empty-state">
          <h3>Este link não está mais disponível.</h3>
          <p>{failed}</p>
          <Link className="primary" href="/descobrir">Ir para o Descobrir</Link>
        </div>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="detail-view shared-view" aria-live="polite">
        <p role="status">Abrindo a conversa compartilhada…</p>
      </section>
    );
  }

  const recordingLabel = (product: SharedProduct) =>
    busyProductId === product.id
      ? "Preparando gravação…"
      : product.content_kits?.length
        ? "Gravar este conteúdo"
        : "Gerar meu roteiro e gravar";

  return (
    <section className="detail-view shared-view tt-discovery" aria-live="polite">
      <nav className="detail-breadcrumb" aria-label="Navegação estrutural">
        <Link href="/descobrir">Descobrir</Link><span>·</span><strong>Conversa compartilhada</strong>
      </nav>
      <header className="shared-header">
        <div className="shared-header-copy">
          <p className="eyebrow">{data.is_owner ? "Sua conversa compartilhada" : "Conversa compartilhada com você"}</p>
          <h1><HighlightedTitle text={data.title} /></h1>
          <p className="shared-meta">
            {data.turn_count} {data.turn_count === 1 ? "pergunta" : "perguntas"} · {products.length} {products.length === 1 ? "produto" : "produtos"} ·{" "}
            {new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(data.criado_em))}
          </p>
        </div>
        <div className="shared-header-actions">
          <div className="shared-view-toggle" role="tablist" aria-label="Formato de visualização">
            <button type="button" role="tab" aria-selected={view === "chat"} className={view === "chat" ? "is-active" : undefined} onClick={() => setView("chat")}>
              <Icon name="message-square" size={15} /> Ver no chatbot
            </button>
            <button type="button" role="tab" aria-selected={view === "roteiro"} className={view === "roteiro" ? "is-active" : undefined} onClick={() => setView("roteiro")}>
              <Icon name="file-text" size={15} /> Ver como roteiro
            </button>
          </div>
          <button className="ghost" type="button" onClick={() => void copyShareLink()}>
            <Icon name="copy" size={15} /> Copiar link
          </button>
          {data.is_owner && (
            revokeAsk ? (
              <button className="danger-button" type="button" disabled={revoking} onClick={() => void revokeLink()}>
                {revoking ? "Desativando…" : "Confirmar desativação"}
              </button>
            ) : (
              <button className="ghost" type="button" onClick={() => setRevokeAsk(true)}>
                <Icon name="trash" size={15} /> Desativar link
              </button>
            )
          )}
        </div>
      </header>

      {view === "chat" ? (
        <div className="shared-chat">
          <div className="chat-thread">
            {data.turns.map((turn, index) => (
              <TurnBlock key={`${turn.query}-${index}`} turn={turn} busyProductId={busyProductId} onRecord={(product) => void startRecording(product)} />
            ))}
          </div>
          <p className="shared-chat-hint">
            <Icon name="video" size={15} /> Toque em um produto para abrir a tela de gravação com o roteiro pronto.
          </p>
        </div>
      ) : (
        <div className="shared-script">
          {products.map((product) => {
            const kits = product.content_kits ?? [];
            return (
              <section key={product.id} className="shared-script-product">
                <header className="shared-script-product-head">
                  <ProductImage product={product} width={220} height={180} />
                  <div className="shared-script-product-copy">
                    <p className="eyebrow">Produto deste roteiro</p>
                    <h2>{fullProductName(product)}</h2>
                    {productFacts(product) && <p className="shared-script-product-meta">{productFacts(product)}</p>}
                    <div className="shared-script-actions">
                      <button className="primary" type="button" disabled={busyProductId === product.id} onClick={() => void startRecording(product)}>
                        {recordingLabel(product)} <Icon name={busyProductId === product.id ? "refresh" : "arrow-right"} size={16} className={busyProductId === product.id ? "is-spinning" : undefined} />
                      </button>
                      {product.tiktok_shop_url && (
                        <a className="ghost" href={product.tiktok_shop_url} target="_blank" rel="noopener noreferrer">
                          Ver no TikTok Shop <Icon name="external-link" size={14} />
                        </a>
                      )}
                    </div>
                  </div>
                </header>
                {kits.length ? (
                  kits.map((kit) => (
                    <article key={kit.id} className="shared-script-kit">
                      <h3>{displayKitTitle(kit, product)}</h3>
                      <KitDocument kit={kit} idPrefix={`shared-${kit.id}`} />
                    </article>
                  ))
                ) : (
                  <div className="empty-state">
                    <h3>Ainda não tem roteiro para este produto.</h3>
                    <p>Gere o seu roteiro e a tela de gravação já abre em seguida.</p>
                    <button className="primary" type="button" disabled={busyProductId === product.id} onClick={() => void startRecording(product)}>
                      {recordingLabel(product)}
                    </button>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
      {planLimitMessage && <UpgradeDialog message={planLimitMessage} onClose={() => setPlanLimitMessage("")} />}
    </section>
  );
}

function TurnBlock({
  turn,
  busyProductId,
  onRecord,
}: {
  turn: SharedTurn;
  busyProductId: string | null;
  onRecord: (product: SharedProduct) => void;
}) {
  return (
    <article className="chat-turn is-past">
      <div className="chat-row is-user">
        <div className="chat-user">
          <span className="chat-author">Você</span>
          <p className="chat-bubble">{turn.query}</p>
          {turn.image_name && <span className="chat-attachment-chip"><Icon name="image" size={14} /> {turn.image_name}</span>}
        </div>
        <span className="chat-avatar is-user" aria-hidden="true"><Icon name="user" size={17} /></span>
      </div>
      <div className="chat-row is-assistant">
        <span className="chat-avatar is-assistant" aria-hidden="true"><Image src="/temtrend-mark.svg" alt="" width={40} height={40} unoptimized /></span>
        <div className="chat-content">
          <span className="chat-author">TemTrend <small>assistente</small></span>
          <p className="chat-message">{turn.message}</p>
          {turn.products.length > 0 && (
            <div className="chat-past-products" aria-label="Produtos sugeridos nesta busca">
              {turn.products.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  className="chat-product"
                  disabled={busyProductId === product.id}
                  onClick={() => onRecord(product)}
                  aria-label={`Gravar conteúdo com ${displayProductName(product)}`}
                >
                  <span className="chat-product-image"><ProductImage product={product} width={48} height={48} /></span>
                  <span className="chat-product-copy">
                    <strong>{displayProductName(product)}</strong>
                    <small>{chipPrice(product)}</small>
                  </span>
                  <Icon name={busyProductId === product.id ? "refresh" : "arrow-right"} size={15} className={busyProductId === product.id ? "is-spinning" : undefined} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
