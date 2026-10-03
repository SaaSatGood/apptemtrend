"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { api, friendlyError } from "@/lib/api";
import { copyText } from "@/lib/format";
import type { ContentKit, CreatorContent, Product } from "@/lib/types";
import { usePlatform } from "./store";
import { KitDocument } from "./ProductKit";
import { kitCopyText } from "./kit-text";
import { PublicationDialog } from "./Production";
import { productionForProduct } from "./Assistant";

export default function KitDetail({ productId, kitId }: { productId: string; kitId: string }) {
  const { productions, toast, loadProductions } = usePlatform();
  const [product, setProduct] = useState<Product | null>(null);
  const [kit, setKit] = useState<ContentKit | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [publishing, setPublishing] = useState<CreatorContent | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase().auth.getSession();
        const detail = await api<{ product: Product; content_kits: ContentKit[] }>(
          `/products/${productId}`,
          data.session?.access_token
        );
        if (cancelled) return;
        const found = detail.content_kits.find((k) => k.id === kitId) || null;
        if (!found) {
          setFailed(true);
          return;
        }
        setProduct(detail.product);
        setKit(found);
      } catch (error) {
        if (!cancelled) {
          setFailed(true);
          toast(friendlyError(error, "Não conseguimos abrir este Content Kit. Tente novamente."));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productId, kitId, toast]);

  if (failed || (!product && !kit)) {
    if (!product && !kit && !failed) {
      return (
        <section className="detail-view" aria-live="polite">
          <div className="empty-state"><h3>Carregando Content Kit...</h3></div>
        </section>
      );
    }
    return (
      <section className="detail-view" aria-live="polite">
        <div className="empty-state">
          <h3>Não encontramos este Content Kit.</h3>
          <p>Ele pode ter sido removido ou pertencer a outro produto.</p>
          <Link className="primary" href={`/app/produtos/${productId}`}>Voltar para o produto</Link>
        </div>
      </section>
    );
  }
  if (!product || !kit) return null;
  const currentProduct = product;
  const currentKit = kit;

  const production = productions.find(
    (item) =>
      item.content_kit_id === currentKit.id ||
      item.content_kits?.id === currentKit.id ||
      (!item.content_kit_id && item.product_id === currentProduct.id)
  );
  const current =
    ({ salvo: 1, em_producao: 2, gravado: 3, publicado: 4 } as Record<string, number>)[
      production?.status ?? "salvo"
    ] || 1;

  async function choose() {
    if (busy) return;
    setBusy(true);
    try {
      const { data } = await supabase().auth.getSession();
      const existing = productionForProduct(productions, currentProduct.id);
      if (!existing) {
        await api("/creator-content", data.session?.access_token, {
          method: "POST",
          body: JSON.stringify({ content_kit_id: currentKit.id }),
        });
      } else if (!existing.content_kit_id) {
        await api(`/creator-content/${existing.id}/content-kit`, data.session?.access_token, {
          method: "POST",
          body: JSON.stringify({ content_kit_id: currentKit.id }),
        });
      }
      await loadProductions().catch(() => {});
      toast("Adicionado à sua produção. ✓");
    } catch (error) {
      toast(friendlyError(error, "Não conseguimos preparar este conteúdo. Tente novamente."));
    } finally {
      setBusy(false);
    }
  }

  async function markRecorded() {
    if (!production || busy) return;
    setBusy(true);
    try {
      const { data } = await supabase().auth.getSession();
      await api(`/creator-content/${production.id}`, data.session?.access_token, {
        method: "PATCH",
        body: JSON.stringify({ status: "gravado" }),
      });
      await loadProductions().catch(() => {});
      toast("Vídeo marcado como gravado ✓ Próximo passo: publicar.");
    } catch (error) {
      toast(friendlyError(error, "Não conseguimos atualizar sua produção. Tente novamente."));
    } finally {
      setBusy(false);
    }
  }

  async function copyAll() {
    const ok = await copyText(kitCopyText(currentKit));
    toast(ok ? "Content Kit copiado ✓" : "Não conseguimos copiar. Tente novamente.");
  }

  return (
    <section className="detail-view" aria-live="polite">
      <header className="content-kit-header">
        <span className="product-category">CONTENT KIT · {currentProduct.nome}</span>
        <h1>{currentKit.titulo}</h1>
        {currentKit.descricao && <p className="preserve-lines">{currentKit.descricao}</p>}
        <div className="kit-meta">
          {[currentKit.formato, currentKit.nivel_dificuldade, currentKit.duracao_seg ? `${currentKit.duracao_seg}s` : null]
            .filter(Boolean)
            .map((v) => (
              <span key={String(v)}>{v}</span>
            ))}
        </div>
      </header>
      <div className="content-kit-layout">
        <KitDocument kit={currentKit} />
        <aside className="kit-actions">
          {!production || production.status === "salvo" ? (
            <>
              <h3>Adicionar à minha produção</h3>
              <p>O produto entra na sua produção e o roteiro fica pronto para gravar.</p>
              <div className="production-progress">
                <strong>{current} de 4 etapas</strong>
              </div>
              <button className="primary" type="button" disabled={busy} onClick={choose}>
                {busy ? "Adicionando..." : "Adicionar à minha produção →"}
              </button>
            </>
          ) : production.status === "em_producao" ? (
            <>
              <span className="production-badge">Content Kit escolhido ✓</span>
              <h3>Produza seu vídeo</h3>
              <div className="production-guidance">
                <strong>A gravação acontece fora da TemTrend.</strong>
                Use o hook, o roteiro e as cenas ao lado no aplicativo de câmera que preferir.
                Depois, volte aqui para atualizar o status.
              </div>
              <button
                className="primary"
                type="button"
                onClick={() => document.querySelector(".kit-document")?.scrollIntoView({ behavior: "smooth" })}
              >
                Produzir vídeo →
              </button>
              <button className="ghost secondary-action" type="button" disabled={busy} onClick={markRecorded}>
                {busy ? "Salvando..." : "Marcar como gravado"}
              </button>
            </>
          ) : production.status === "gravado" ? (
            <>
              <span className="production-badge">Vídeo gravado ✓</span>
              <h3>Próximo passo</h3>
              <p>Publique o vídeo manualmente e volte para concluir sua produção.</p>
              <button className="primary" type="button" onClick={() => setPublishing(production)}>
                Marcar como publicado →
              </button>
            </>
          ) : (
            <>
              <span className="published-check">✓</span>
              <h3>Conteúdo publicado</h3>
              <p>Sua produção está concluída.</p>
              {production.published_url ? (
                <>
                  <a className="primary action-link" href={production.published_url} target="_blank" rel="noopener noreferrer">
                    Ver publicação →
                  </a>
                  <button className="ghost" type="button" onClick={() => setPublishing(production)}>
                    Alterar link
                  </button>
                </>
              ) : (
                <button className="primary" type="button" onClick={() => setPublishing(production)}>
                  Adicionar link do TikTok
                </button>
              )}
            </>
          )}
          <button className="ghost" type="button" onClick={copyAll}>
            Copiar Content Kit
          </button>
          <Link className="text-button" href="/app/producao">
            Ir para Minha produção
          </Link>
        </aside>
      </div>
      {publishing && (
        <PublicationDialog content={publishing} onClose={() => setPublishing(null)} />
      )}
    </section>
  );
}
