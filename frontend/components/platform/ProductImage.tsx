"use client";

import { useState } from "react";
import Image from "next/image";
import Icon, { type IconName } from "@/components/ui/Icon";
import { fullProductName } from "@/lib/format";
import type { Product } from "@/lib/types";

function CategoryIcon({ category }: { category?: string | null }) {
  const value = (category || "").toLocaleLowerCase("pt-BR");
  const name: IconName = /casa|cozinha|doméstic|moveis|móveis/.test(value)
    ? "home"
    : /beleza|cuidado|saúde/.test(value)
      ? "droplet"
      : /roupa|moda|têxteis|acessório/.test(value)
        ? "shirt"
        : /eletrôn|telefone|gadget|eletrodoméstic/.test(value)
          ? "smartphone"
          : "shopping-bag";
  return <Icon name={name} size={34} />;
}

export default function ProductImage({ product, width = 400, height = 300, className = "" }: { product: Pick<Product, "nome" | "imagem_url" | "categoria">; width?: number; height?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const name = fullProductName(product);
  if (!product.imagem_url || failed) return <div className={`product-image-fallback ${className}`} role="img" aria-label={`Imagem indisponível: ${name}`} title={name}><span><CategoryIcon category={product.categoria} /></span></div>;
  return <Image className={className} src={product.imagem_url} alt={name} width={width} height={height} loading="lazy" unoptimized onError={() => setFailed(true)} />;
}
