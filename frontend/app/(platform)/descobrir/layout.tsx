import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Descobrir produtos",
  description: "Busque produtos do TikTok Shop, compare comissão e vendas e receba um plano de gravação.",
  path: "/descobrir",
  noindex: true,
});


export default function RouteLayout({ children }: { children: ReactNode }) {
  return children;
}
