import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../styles/landing.css";
import "../styles/landing-refinements.css";
import "../styles/landing-fixes.css";
import "../styles/styles.css";
import "../styles/dashboard-assistant.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "TemTrend — Venda no TikTok Shop",
  description:
    "Encontre produtos para vender no TikTok Shop e descubra exatamente o que criar para transformar produtos em conteúdo.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
