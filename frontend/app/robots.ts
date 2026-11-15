import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.temtrend.com";

// Área logada e endpoints de conta nunca entram no índice: são privados e não
// têm conteúdo útil para busca.
const PRIVATE_PATHS = [
  "/descobrir",
  "/produtos",
  "/producao",
  "/conteudos",
  "/calendario",
  "/resultados",
  "/conta",
  "/preferencias",
  "/suporte",
  "/admin",
  "/compartilhar",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
