"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ProductDetail from "@/components/platform/ProductKit";
import ContentKitDialog from "@/components/platform/ContentKitDialog";
import type { Product } from "@/lib/types";

export default function ProdutoPage() {
  const params = useParams<{ productId: string }>();
  const router = useRouter();
  const [kitDialog, setKitDialog] = useState<{
    productId: string;
    mode: "save" | "kit";
    forceNew: boolean;
    product: Product;
  } | null>(null);

  return (
    <>
      <ProductDetail
        key={params.productId}
        productId={params.productId}
        onNeedKit={(productId, mode, forceNew, product) => setKitDialog({ productId, mode, forceNew, product })}
      />
      {kitDialog && (
        <ContentKitDialog
          productId={kitDialog.productId}
          product={kitDialog.product}
          mode={kitDialog.mode}
          forceNew={kitDialog.forceNew}
          onClose={() => setKitDialog(null)}
          onCreated={(kit) => {
            setKitDialog(null);
            router.push(`/produtos/${kitDialog.productId}/kits/${kit.id}`);
          }}
        />
      )}
    </>
  );
}
