"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { api, friendlyError } from "@/lib/api";
import { loadProductDetail, peekProductDetail, removeProductKit, type ProductDetail } from "@/lib/product-detail-cache";
import type { CreatorContent } from "@/lib/types";
import { usePlatform } from "./store";
import { Skeletons } from "./ProductKit";
import { PublicationDialog } from "./Production";
import { productionForProduct } from "./production-helpers";
import RecordingWizard from "./RecordingWizard";

export default function KitDetail({ productId, kitId: initialKitId, embedded = false, onClose }: { productId: string; kitId: string; embedded?: boolean; onClose?: () => void }) {
  const router = useRouter();
  // Dentro do popup do chat, trocar de roteiro acontece aqui, sem mudar de página.
  const [kitId, setKitId] = useState(initialKitId);
  const { session, productions, productionsLoading, productionsError, toast, loadProductions } = usePlatform();
  const [detail, setDetail] = useState<ProductDetail | null>(() => {
    const cached = peekProductDetail(productId);
    return cached?.content_kits.some((item) => item.id === kitId) ? cached : null;
  });
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [publishing, setPublishing] = useState<CreatorContent | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cached = peekProductDetail(productId);
    const cachedForRoute = cached?.content_kits.some((item) => item.id === kitId) ? cached : null;
    (async () => {
      try {
        let loaded = await loadProductDetail(productId, session?.access_token, {
          // Cache sem este roteiro pode ser de antes de uma geração: força a
          // revalidação em vez de mostrar "não encontrado" por engano.
          force: !cachedForRoute,
        });
        if (cancelled) return;
        let found = loaded.content_kits.find((item) => item.id === kitId) || null;
        if (!found && cachedForRoute) {
          // Havia uma requisição anterior em voo quando o roteiro foi criado.
          // Confirma com uma leitura forçada antes de negar o conteúdo.
          loaded = await loadProductDetail(productId, session?.access_token, { force: true });
          if (cancelled) return;
          found = loaded.content_kits.find((item) => item.id === kitId) || null;
        }
        if (!found) {
          setFailed(true);
          return;
        }
        setDetail(loaded);
        setFailed(false);
      } catch (error) {
        if (cancelled) return;
        if (!cachedForRoute) {
          setFailed(true);
          toast(friendlyError(error, "Não conseguimos abrir este plano de gravação. Tente novamente."));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [productId, kitId, session?.access_token, toast]);

  const product = detail?.product ?? null;
  const kit = detail?.content_kits.find((item) => item.id === kitId) ?? null;

  if (failed || (!product && !kit)) {
    if (!failed) return <section className="detail-view" aria-live="polite"><p role="status">Carregando seu conteúdo…</p><div className="product-grid"><Skeletons /></div></section>;
    return <section className="detail-view" aria-live="polite"><div className="empty-state"><h3>Não encontramos este plano de gravação.</h3><p>Ele pode ter sido removido ou pertencer a outro produto.</p>{!embedded && <Link className="primary" href={`/produtos/${productId}`}>Voltar para o produto</Link>}</div></section>;
  }
  if (!product || !kit) return null;

  const currentProduct = product;
  const currentKit = kit;
  const productProduction = productionForProduct(productions, currentProduct.id);
  const otherKitInProgress = productProduction && productProduction.status !== "salvo" && productProduction.content_kit_id !== currentKit.id;
  const production = productions.find((item) => item.content_kit_id === currentKit.id || item.content_kits?.id === currentKit.id || (!item.content_kit_id && item.product_id === currentProduct.id));
  const statusLabel = productionsError ? "Progresso indisponível" : productionsLoading ? "Conferindo progresso" : otherKitInProgress ? "Outro roteiro em produção" : production ? ({ salvo: "Roteiro salvo", em_producao: "Em produção", gravado: "Vídeo gravado", publicado: "Publicado" } as Record<string, string>)[production.status] || "Roteiro pronto" : "Roteiro pronto";
  const readyLabel = productionsError ? "Tentar novamente" : productionsLoading ? "Conferindo…" : otherKitInProgress ? "Continuar produção" : production?.status === "gravado" ? "Marcar como publicado" : production?.status === "publicado" ? "Produtos selecionados" : "Marcar como gravado";

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
      toast("Vídeo marcado como gravado. Próximo passo: publicar.");
    } catch (error) { toast(friendlyError(error, "Não conseguimos atualizar sua produção. Tente novamente.")); }
    finally { setBusy(false); }
  }

  async function deleteKit(): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    try {
      const { data } = await supabase().auth.getSession();
      await api(`/products/${productId}/content-kits/${currentKit.id}`, data.session?.access_token, { method: "DELETE" });
      removeProductKit(productId, currentKit.id);
      await loadProductions().catch(() => {});
      toast("Roteiro excluído.");
      if (embedded) onClose?.();
      else router.replace(`/produtos/${productId}`);
      return true;
    } catch (error) {
      toast(friendlyError(error, "Não conseguimos excluir este roteiro. Tente novamente."));
      return false;
    } finally {
      setBusy(false);
    }
  }

  function continueProduction() {
    if (productionsError) { void loadProductions().catch(() => {}); return; }
    if (productionsLoading || busy) return;
    if (otherKitInProgress && productProduction.content_kit_id) {
      if (embedded) setKitId(productProduction.content_kit_id);
      else router.push(`/produtos/${productId}/kits/${productProduction.content_kit_id}`);
      return;
    }
    if (!production || production.status === "salvo" || production.status === "em_producao") { void markRecorded(); return; }
    if (production.status === "gravado" || !production.published_url) { setPublishing(production); return; }
    if (embedded) toast("Este conteúdo já foi publicado. Ele aparece em Produção.");
    else router.push("/producao");
  }

  return (
    <section className={embedded ? "rw-embedded" : "detail-view kit-focus-view"} aria-live="polite">
      <RecordingWizard
        kit={currentKit}
        product={currentProduct}
        readyLabel={readyLabel}
        readyDisabled={busy || productionsLoading}
        statusLabel={statusLabel}
        onReady={continueProduction}
        onDelete={deleteKit}
        onClose={onClose}
      />
      {publishing && <PublicationDialog content={publishing} onClose={() => setPublishing(null)} />}
    </section>
  );
}
