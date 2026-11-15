import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Resultados",
  description: "Acompanhe o desempenho dos seus conteúdos e veja o que funciona melhor para repetir.",
  path: "/resultados",
  noindex: true,
});


export default function RouteLayout({ children }: { children: ReactNode }) {
  return children;
}
