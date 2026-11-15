import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Preferências",
  description: "Ajuste objetivo, estilos, temas e sua voz para personalizar as buscas e os roteiros da IA.",
  path: "/preferencias",
  noindex: true,
});


export default function RouteLayout({ children }: { children: ReactNode }) {
  return children;
}
