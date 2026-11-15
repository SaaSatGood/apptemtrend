import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Conversa do Descobrir | TemTrend",
  description: "Retome uma conversa de descoberta de produtos da sua conta TemTrend.",
  path: "/descobrir",
  absoluteTitle: true,
  noindex: true,
});


export default function RouteLayout({ children }: { children: ReactNode }) {
  return children;
}
