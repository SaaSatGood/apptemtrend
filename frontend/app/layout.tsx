import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Manrope } from "next/font/google";
import "../styles/landing.css";
import "../styles/landing-refinements.css";
import "../styles/landing-fixes.css";
import "../styles/styles.css";
import "../styles/dashboard-assistant.css";
import "../styles/design-system.css";
import "../styles/landing-polish.css";
import "../styles/landing-experience.css";
import "../styles/platform-theme.css";
import "../styles/platform-journey.css";
import "../styles/onboarding.css";
import "../styles/signup-fit.css";
import "../styles/discovery-results.css";
import "../styles/guided-kit.css";
import "../styles/ux-overhaul.css";
import "../styles/document-pages.css";
import "../styles/landing-reference.css";
import "../styles/landing-refine.css";
import "../styles/landing-rebuild.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
});

export const metadata: Metadata = {
  title: "TemTrend — Venda no TikTok Shop",
  description:
    "Encontre produtos para vender no TikTok Shop e descubra exatamente o que criar para transformar produtos em conteúdo.",
  icons: { icon: "/temtrend-mark.svg" },
};

export const viewport: Viewport = { themeColor: "#fbfcf8" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth">
      <body className={`${manrope.variable} ${manrope.className} ${instrumentSerif.variable}`}>{children}</body>
    </html>
  );
}
