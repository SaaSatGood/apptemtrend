import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TemTrend — Produtos e roteiros para o TikTok Shop",
    short_name: "TemTrend",
    description:
      "Encontre produtos para vender no TikTok Shop e receba um plano de gravação em 8 partes.",
    start_url: "/descobrir",
    display: "standalone",
    background_color: "#fbfaff",
    theme_color: "#6d28d9",
    lang: "pt-BR",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
