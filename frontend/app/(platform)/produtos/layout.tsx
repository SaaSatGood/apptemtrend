import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Catálogo de produtos",
  description: "Explore o catálogo completo de produtos do TikTok Shop com preço, comissão e vendas.",
  path: "/produtos",
  noindex: true,
});


export default function RouteLayout({ children }: { children: ReactNode }) {
  return children;
}
