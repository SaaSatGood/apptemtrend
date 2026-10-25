import type { Metadata, Viewport } from "next";
import { Inter_Tight, Poppins } from "next/font/google";
import { themeBootstrapScript } from "@/components/platform/ThemeToggle";
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
import "../styles/landing-navbar.css";
import "../styles/entry-flow.css";
import "../styles/platform-redesign.css";
import "../styles/pricing.css";
import "../styles/support.css";
import "../styles/canonical.css";
import "../styles/landing-lime.css";
import "../styles/auth-lime.css";
import "../styles/app-dashboard.css";
import "../styles/icons.css";

const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-inter-tight",
});

// Fonte de exibicao do produto: landing, painel e descoberta.
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-poppins",
  display: "swap",
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
    <html lang="pt-BR" data-scroll-behavior="smooth" className={`${interTight.variable} ${poppins.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className={interTight.className}>{children}</body>
    </html>
  );
}
