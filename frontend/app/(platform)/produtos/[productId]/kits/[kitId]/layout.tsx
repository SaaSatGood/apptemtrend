import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Plano de gravação | TemTrend",
  description: "Abra o plano de gravação em 8 partes e siga as cenas até a publicação do vídeo.",
  path: "/produtos",
  absoluteTitle: true,
  noindex: true,
});


export default function RouteLayout({ children }: { children: ReactNode }) {
  return children;
}
