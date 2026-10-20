"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import RequireAuth from "@/components/platform/RequireAuth";
import Topbar from "@/components/platform/Topbar";
import ProductDetail from "@/components/platform/ProductKit";
import ContentKitDialog from "@/components/platform/ContentKitDialog";
import type { Product } from "@/lib/types";

function Content() {
  const params = useParams<{ productId: string }>();
  const router = useRouter();
  const [kitDialog, setKitDialog] = useState<{
    productId: string;
    mode: "save" | "kit";
    forceNew: boolean;
    product: Product;
  } | null>(null);

  return (
    <main id="app-view">
      <Topbar />
      <section id="page-content" className="page-wrap">
        <ProductDetail
          key={params.productId}
          productId={params.productId}
          onNeedKit={(productId, mode, forceNew, product) => setKitDialog({ productId, mode, forceNew, product })}
        />
      </section>
      {kitDialog && (
        <ContentKitDialog
          productId={kitDialog.productId}
          product={kitDialog.product}
          mode={kitDialog.mode}
          forceNew={kitDialog.forceNew}
          onClose={() => setKitDialog(null)}
          onCreated={(kit) => {
            setKitDialog(null);
            router.push(`/app/produtos/${kitDialog.productId}/kits/${kit.id}`);
          }}
        />
      )}
    </main>
  );
}

export default function ProdutoPage() {
  return (
    <RequireAuth>
      <Content />
    </RequireAuth>
  );
}
