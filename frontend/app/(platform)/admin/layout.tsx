import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Administração",
  description: "Painel interno da TemTrend: catálogo, creators, assinaturas, suporte, uso de IA e funil.",
  path: "/admin",
  noindex: true,
});


export default function RouteLayout({ children }: { children: ReactNode }) {
  return children;
}
