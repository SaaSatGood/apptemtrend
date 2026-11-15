import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Minha conta",
  description: "Gerencie perfil, senha, preferências, plano e assinatura da sua conta TemTrend.",
  path: "/conta",
  noindex: true,
});


export default function RouteLayout({ children }: { children: ReactNode }) {
  return children;
}
