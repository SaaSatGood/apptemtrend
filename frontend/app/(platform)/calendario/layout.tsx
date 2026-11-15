import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Calendário editorial",
  description: "Planeje as datas de gravação e publicação dos seus conteúdos em um calendário mensal.",
  path: "/calendario",
  noindex: true,
});


export default function RouteLayout({ children }: { children: ReactNode }) {
  return children;
}
