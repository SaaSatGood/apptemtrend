import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Minha produção",
  description: "Acompanhe seus produtos salvos do status inicial até a publicação manual do vídeo.",
  path: "/producao",
  noindex: true,
});


export default function RouteLayout({ children }: { children: ReactNode }) {
  return children;
}
