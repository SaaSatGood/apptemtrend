import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Suporte",
  description: "Fale com o assistente de suporte da TemTrend ou abra uma conversa com o time.",
  path: "/suporte",
  noindex: true,
});


export default function RouteLayout({ children }: { children: ReactNode }) {
  return children;
}
