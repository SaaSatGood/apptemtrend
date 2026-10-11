"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { api, friendlyError } from "@/lib/api";
import { normalizeScenes } from "@/lib/format";
import type { ContentKit, CreatorContent, Product } from "@/lib/types";
import { usePlatform } from "./store";
import { CopyButton, KitDocument, Skeletons } from "./ProductKit";
import ProductionSteps from "./ProductionSteps";
import ContentKitDialog from "./ContentKitDialog";
import { kitCopyText } from "./kit-text";
import { PublicationDialog } from "./Production";
import { productionForProduct } from "./Assistant";
import GuidedKit from "./GuidedKit";

export default function KitDetail({ productId, kitId }: { productId: string; kitId: string }) {
  const router = useRouter();
  const { productions, productionsLoading, productionsError, toast, loadProductions } = usePlatform();
  const [product, setProduct] = useState<Product | null>(null);
  const [kit, setKit] = useState<ContentKit | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
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
          toast(friendlyError(error, "Não conseguimos abrir este plano de gravação. Tente novamente."));
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
          <p role="status">Carregando seu Content Kit…</p><div className="product-grid"><Skeletons /></div>
        </section>
      );
    }
    return (
      <section className="detail-view" aria-live="polite">
        <div className="empty-state">
          <h3>Não encontramos este plano de gravação.</h3>
          <p>Ele pode ter sido removido ou pertencer a outro produto.</p>
          <Link className="primary" href={`/app/produtos/${productId}`}>← Voltar para o produto</Link>
        </div>
      </section>
    );
  }
  if (!product || !kit) return null;
  const currentProduct = product;
  const currentKit = kit;
  const productProduction = productionForProduct(productions, product.id);
  const otherKitInProgress = productProduction && productProduction.status !== "salvo" && productProduction.content_kit_id !== currentKit.id;

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
      } else if (!existing.content_kit_id || existing.status === "salvo") {
        await api(`/creator-content/${existing.id}/content-kit`, data.session?.access_token, {
          method: "POST",
          body: JSON.stringify({ content_kit_id: currentKit.id }),
        });
      }
      await loadProductions().catch(() => {});
      toast("Produção iniciada ✓ Agora siga as cenas para gravar seu vídeo.");
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

  return (
    <section className="detail-view" aria-live="polite">
      <nav className="detail-breadcrumb" aria-label="Navegação estrutural">
        <Link href="/app">Descobrir</Link><span>›</span>
        <Link href={`/app/produtos/${currentProduct.id}`}>Produto</Link><span>›</span>
        <strong>Content Kit</strong>
      </nav>
      <header className="content-kit-header">
        <p className="eyebrow">Seu Content Kit</p>
        <span className="product-category">{currentProduct.nome}</span>
        <h1>{currentKit.titulo}</h1>
        {currentKit.usou_voz && <p className="kit-voice-badge" role="note">No seu jeito ✓</p>}
        {currentKit.descricao && <p className="preserve-lines">{currentKit.descricao}</p>}
        <div className="kit-meta">
          {[currentKit.formato, currentKit.nivel_dificuldade, currentKit.duracao_seg ? `${currentKit.duracao_seg}s` : null]
            .filter(Boolean)
            .map((v) => (
              <span key={String(v)}>{v}</span>
            ))}
        </div>
      </header>
      <GuidedKit
        kit={currentKit}
        product={currentProduct}
        readyLabel={!otherKitInProgress && (!production || production.status === "salvo") ? "Começar produção →" : "Ver meu próximo passo →"}
        onReady={() => {
          if (!otherKitInProgress && (!production || production.status === "salvo")) {
            void choose();
          } else {
            document.getElementById("kit-production-actions")?.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }}
      />
      <ProductionSteps current={production ? current : 0} />
      <div className="kit-complete-heading"><div><p className="eyebrow">Para consultar e copiar</p><h2>Roteiro completo</h2></div><p>Todos os textos do seu vídeo em um só lugar.</p></div>
      <nav className="kit-jump-nav" aria-label="Ir para uma seção do plano de gravação">
        <span>Ir para</span>
        {currentKit.hook && <a href="#kit-hook">Hook ↗</a>}
        {normalizeScenes(currentKit.cenas).length > 0 && <a href="#kit-cenas">Cenas ↗</a>}
        {currentKit.roteiro && <a href="#kit-roteiro">Roteiro ↗</a>}
        {currentKit.copy && <a href="#kit-legenda">Legenda ↗</a>}
      </nav>
      <div className="content-kit-layout">
        <KitDocument kit={currentKit} />
        <aside id="kit-production-actions" className="kit-actions">
          {productionsError ? <><h3>Atualize sua produção</h3><p>Precisamos conferir seu progresso antes de continuar.</p><button className="primary" type="button" disabled={productionsLoading} onClick={() => void loadProductions().catch(() => {})}>Tentar novamente</button></> : productionsLoading ? <p role="status">Conferindo sua produção…</p> : otherKitInProgress ? <><h3>Você já tem uma produção</h3><p>Este kit é uma alternativa. O roteiro escolhido e o progresso atual foram mantidos.</p><Link className="primary" href={`/app/produtos/${productId}/kits/${productProduction.content_kit_id}`}>Continuar produção →</Link></> : !production || production.status === "salvo" ? (
            <>
              <h3>Pronto para gravar?</h3>
              <p>Escolha este Content Kit e comece a produzir seu vídeo, uma cena de cada vez.</p>
              <div className="production-progress">
                <strong>{current} de 4 etapas</strong>
              </div>
              <button className="primary" type="button" disabled={busy} onClick={choose}>
                {busy ? "Iniciando…" : "Começar produção →"}
              </button>
            </>
          ) : production.status === "em_producao" ? (
            <>
              <span className="production-badge">Em produção</span>
              <h3>Produza seu vídeo</h3>
              <div className="production-guidance">
                <strong>A gravação acontece fora da TemTrend.</strong>
                Use o hook, o roteiro e as cenas ao lado no aplicativo de câmera que preferir.
                Depois, volte aqui para atualizar o status.
              </div>
              <button className="primary" type="button" disabled={busy} onClick={markRecorded}>
                {busy ? "Salvando..." : "Marcar como gravado"}
              </button>
              <a className="text-button" href="#kit-document">Ver guia de gravação ↓</a>
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
          <CopyButton id="copy-kit" text={kitCopyText(currentKit)} doneText="Copiado ✓">Copiar tudo</CopyButton>
          <button className="ghost" type="button" onClick={() => setGenerating(true)}>Gerar outro Content Kit</button>
          <Link className="text-button" href="/app/producao">
            Ir para Minha produção
          </Link>
          <Link className="text-button" href={`/app/produtos/${currentProduct.id}`}>
            Voltar para o produto
          </Link>
        </aside>
      </div>
      {publishing && (
        <PublicationDialog content={publishing} onClose={() => setPublishing(null)} />
      )}
      {generating && <ContentKitDialog productId={productId} mode="kit" forceNew onClose={() => setGenerating(false)} onCreated={(created) => { setGenerating(false); router.push(`/app/produtos/${productId}/kits/${created.id}`); }} />}
    </section>
  );
}
