"use client";

import { useState } from "react";
import Image from "next/image";
import { fullProductName } from "@/lib/format";
import type { Product } from "@/lib/types";

export default function ProductImage({ product, width = 400, height = 300, className = "" }: { product: Pick<Product, "nome" | "imagem_url" | "categoria">; width?: number; height?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const name = fullProductName(product);
  const category = product.categoria || "Produto";
  const shades = ["#eaf5cc", "#f0f6dc", "#e6f2d4", "#f3f7e9", "#e8f4d9"];
  const shade = shades[[...category].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % shades.length];
  if (!product.imagem_url || failed) return <div className={`product-image-fallback ${className}`} style={{ backgroundColor: shade }} role="img" aria-label={`Imagem indisponível: ${name}`} title={name}><span>{name[0].toLocaleUpperCase("pt-BR")}</span></div>;
  return <Image className={className} src={product.imagem_url} alt={name} width={width} height={height} loading="lazy" unoptimized onError={() => setFailed(true)} />;
}
