"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { api, friendlyError } from "@/lib/api";
import type { ContentKit, CreatorContent, Product } from "@/lib/types";
import { usePlatform } from "./store";
import { Skeletons } from "./ProductKit";
import ContentKitDialog from "./ContentKitDialog";
import { PublicationDialog } from "./Production";
import { productionForProduct } from "./Assistant";
import { kitContext } from "./kit-presentation";
import GuidedKit from "./GuidedKit";
import ProductionSteps from "./ProductionSteps";
import EmphasizedTitle from "./EmphasizedTitle";

export default function KitDetail({ productId, kitId }: { productId: string; kitId: string }) {
  const router = useRouter();
  const { productions, productionsLoading, productionsError, toast, loadProductions } = usePlatform();
  const [product, setProduct] = useState<Product | null>(null);
  const [kit, setKit] = useState<ContentKit | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [generatingBriefing, setGeneratingBriefing] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<CreatorContent | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase().auth.getSession();
        const detail = await api<{ product: Product; content_kits: ContentKit[] }>(`/products/${productId}`, data.session?.access_token);
        if (cancelled) return;
        const found = detail.content_kits.find((item) => item.id === kitId) || null;
        if (!found) { setFailed(true); return; }
        setProduct(detail.product);
        setKit(found);
      } catch (error) {
        if (!cancelled) { setFailed(true); toast(friendlyError(error, "Não conseguimos abrir este plano de gravação. Tente novamente.")); }
      }
    })();
    return () => { cancelled = true; };
  }, [productId, kitId, toast]);

  if (failed || (!product && !kit)) {
    if (!failed) return <section className="detail-view" aria-live="polite"><p role="status">Carregando seu Content Kit…</p><div className="product-grid"><Skeletons /></div></section>;
    return <section className="detail-view" aria-live="polite"><div className="empty-state"><h3>Não encontramos este plano de gravação.</h3><p>Ele pode ter sido removido ou pertencer a outro produto.</p><Link className="primary" href={`/app/produtos/${productId}`}>← Voltar para o produto</Link></div></section>;
  }
  if (!product || !kit) return null;

  const currentProduct = product;
  const currentKit = kit;
  const context = kitContext(currentKit, currentProduct);
  const productProduction = productionForProduct(productions, currentProduct.id);
  const otherKitInProgress = productProduction && productProduction.status !== "salvo" && productProduction.content_kit_id !== currentKit.id;
  const production = productions.find((item) => item.content_kit_id === currentKit.id || item.content_kits?.id === currentKit.id || (!item.content_kit_id && item.product_id === currentProduct.id));
  const statusLabel = productionsError ? "Progresso indisponível" : productionsLoading ? "Conferindo progresso" : otherKitInProgress ? "Outro roteiro em produção" : production ? ({ salvo: "Roteiro salvo", em_producao: "Em produção", gravado: "Vídeo gravado", publicado: "Publicado" } as Record<string, string>)[production.status] || "Roteiro pronto" : "Roteiro pronto";
  const readyLabel = productionsError ? "Tentar novamente" : productionsLoading ? "Conferindo…" : otherKitInProgress ? "Continuar produção →" : production?.status === "gravado" ? "Marcar como publicado →" : production?.status === "publicado" ? "Minha produção →" : "Marcar como gravado →";

  async function markRecorded() {
    if (busy || productionsLoading || productionsError) return;
    setBusy(true);
    try {
      const { data } = await supabase().auth.getSession();
      let active = production;
      if (!active) active = await api<CreatorContent>("/creator-content", data.session?.access_token, { method: "POST", body: JSON.stringify({ content_kit_id: currentKit.id }) });
      else if (active.status === "salvo") active = await api<CreatorContent>(`/creator-content/${active.id}/content-kit`, data.session?.access_token, { method: "POST", body: JSON.stringify({ content_kit_id: currentKit.id }) });
      if (active.status === "em_producao") await api(`/creator-content/${active.id}`, data.session?.access_token, { method: "PATCH", body: JSON.stringify({ status: "gravado" }) });
      await loadProductions().catch(() => {});
      toast("Vídeo marcado como gravado ✓ Próximo passo: publicar.");
    } catch (error) { toast(friendlyError(error, "Não conseguimos atualizar sua produção. Tente novamente.")); }
    finally { setBusy(false); }
  }

  function continueProduction() {
    if (productionsError) { void loadProductions().catch(() => {}); return; }
    if (productionsLoading || busy) return;
    if (otherKitInProgress && productProduction.content_kit_id) { router.push(`/app/produtos/${productId}/kits/${productProduction.content_kit_id}`); return; }
    if (!production || production.status === "salvo" || production.status === "em_producao") { void markRecorded(); return; }
    if (production.status === "gravado" || !production.published_url) { setPublishing(production); return; }
    router.push("/app/producao");
  }

  return (
    <section className="detail-view kit-focus-view" aria-live="polite">
      <nav className="detail-breadcrumb" aria-label="Navegação estrutural"><Link href="/app">Descobrir</Link><span>›</span><Link href={`/app/produtos/${currentProduct.id}`}>Produto</Link><span>›</span><strong>Content Kit</strong></nav>
      <header className="content-kit-header">
        <p className="eyebrow">Seu Content Kit</p>
        <h1><EmphasizedTitle text={currentKit.titulo} /></h1>
        <p className="kit-summary">{context.summary}</p>
        <div className="kit-side">
        {(context.audience || context.sales) && <div className="kit-context">{context.audience && <p><strong>Para quem</strong><span>{context.audience}</span></p>}{context.sales && <p><strong>Por que agora</strong><span>{context.sales}</span></p>}</div>}
        <div className="kit-meta">{[currentKit.formato, currentKit.nivel_dificuldade, currentKit.duracao_seg ? `${currentKit.duracao_seg}s` : null].filter(Boolean).map((value) => <span key={String(value)}>{value}</span>)}{currentKit.usou_voz && <span>No seu jeito ✓</span>}</div>
        </div>
      </header>
      <div className="production-status"><p className="eyebrow">Status da produção</p><ProductionSteps current={production ? ({ salvo: 1, em_producao: 2, gravado: 3, publicado: 4 })[production.status] : 1} /></div>
      <GuidedKit
        kit={currentKit}
        product={currentProduct}
        readyLabel={readyLabel}
        readyDisabled={busy || productionsLoading}
        status={production?.status || "salvo"}
        statusLabel={statusLabel}
        onReady={continueProduction}
        onAllScenesRecorded={() => { if (!otherKitInProgress && production?.status !== "gravado" && production?.status !== "publicado") void markRecorded(); }}
        onGenerateVariant={(idea) => setGeneratingBriefing(`Crie uma nova versão do roteiro usando esta abordagem: ${idea}`)}
        onGenerateAnother={() => setGeneratingBriefing("")}
      />
      {publishing && <PublicationDialog content={publishing} onClose={() => setPublishing(null)} />}
      {generatingBriefing !== null && <ContentKitDialog productId={productId} mode="kit" forceNew initialBriefing={generatingBriefing} onClose={() => setGeneratingBriefing(null)} onCreated={(created) => { setGeneratingBriefing(null); router.push(`/app/produtos/${productId}/kits/${created.id}`); }} />}
    </section>
  );
}
