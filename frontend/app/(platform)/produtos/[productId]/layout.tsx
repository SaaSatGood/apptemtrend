import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Detalhes do produto | TemTrend",
  description: "Veja preço, comissão estimada, vendas e roteiros salvos de um produto do catálogo.",
  path: "/produtos",
  absoluteTitle: true,
  noindex: true,
});


export default function RouteLayout({ children }: { children: ReactNode }) {
  return children;
}
