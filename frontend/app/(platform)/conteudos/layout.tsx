import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Meus conteúdos",
  description: "Biblioteca de roteiros e conteúdos da sua produção, com status, busca e agendamento.",
  path: "/conteudos",
  noindex: true,
});


export default function RouteLayout({ children }: { children: ReactNode }) {
  return children;
}
