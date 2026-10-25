"use client";

import { useParams } from "next/navigation";
import KitDetail from "@/components/platform/KitDetail";

export default function KitPage() {
  const params = useParams<{ productId: string; kitId: string }>();

  return (
    <KitDetail
      key={params.kitId}
      productId={params.productId}
      kitId={params.kitId}
    />
  );
}
