"use client";

import { useState } from "react";
import Image from "next/image";
import { fullProductName } from "@/lib/format";
import type { Product } from "@/lib/types";

function CategoryIcon({ category }: { category?: string | null }) {
  const value = (category || "").toLocaleLowerCase("pt-BR");
  const path = /casa|cozinha|doméstic|moveis|móveis/.test(value)
    ? <><path d="m3 11 9-7 9 7v9H3z" /><path d="M9 20v-6h6v6" /></>
    : /beleza|cuidado|saúde/.test(value)
      ? <><path d="M12 3c2.5 4.2 5 7 5 10a5 5 0 0 1-10 0c0-3 2.5-5.8 5-10Z" /><path d="M9 14c.4 1.2 1.4 2 3 2" /></>
      : /roupa|moda|têxteis|acessório/.test(value)
        ? <><path d="m8 4-5 4 3 4 2-2v10h8V10l2 2 3-4-5-4-4 2z" /></>
        : /eletrôn|telefone|gadget|eletrodoméstic/.test(value)
          ? <><rect x="6" y="2" width="12" height="20" rx="2" /><path d="M11 18h2" /></>
          : <><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M3 10h18M9 6V4h6v2" /></>;
  return <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{path}</svg>;
}

export default function ProductImage({ product, width = 400, height = 300, className = "" }: { product: Pick<Product, "nome" | "imagem_url" | "categoria">; width?: number; height?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const name = fullProductName(product);
  if (!product.imagem_url || failed) return <div className={`product-image-fallback ${className}`} role="img" aria-label={`Imagem indisponível: ${name}`} title={name}><span><CategoryIcon category={product.categoria} /></span></div>;
  return <Image className={className} src={product.imagem_url} alt={name} width={width} height={height} loading="lazy" unoptimized onError={() => setFailed(true)} />;
}
