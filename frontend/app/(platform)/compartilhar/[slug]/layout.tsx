import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Conversa compartilhada",
  description: "Veja a conversa do Descobrir compartilhada por um creator da TemTrend.",
  path: "/compartilhar",
  noindex: true,
});


export default function RouteLayout({ children }: { children: ReactNode }) {
  return children;
}
