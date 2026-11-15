import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, JetBrains_Mono, Onest } from "next/font/google";
import { themeBootstrapScript } from "@/components/platform/ThemeToggle";
import RecoveryRedirect from "@/components/RecoveryRedirect";
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
import "../styles/signup-fit.css";
import "../styles/discovery-results.css";
import "../styles/guided-kit.css";
import "../styles/ux-overhaul.css";
import "../styles/document-pages.css";
import "../styles/landing-reference.css";
import "../styles/landing-refine.css";
import "../styles/landing-navbar.css";
import "../styles/entry-flow.css";
import "../styles/platform-redesign.css";
import "../styles/pricing.css";
import "../styles/support.css";
import "../styles/canonical.css";
import "../styles/landing-lime.css";
import "../styles/hero-conversion.css";
import "../styles/hero-reference.css";
import "../styles/icons.css";
import "../styles/landing-2026.css";
import "../styles/button-system.css";
import "../styles/landing-steps-2026.css";

const onest = Onest({
  subsets: ["latin"],
  variable: "--font-onest",
  display: "swap",
});

// Fonte de exibição: títulos, hero e nomes de produto.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-bricolage",
  display: "swap",
});

// Números, códigos de cor e dados tabulares.
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.temtrend.com";

const DEFAULT_TITLE = "TemTrend — Produtos e roteiros para o TikTok Shop";
const DEFAULT_DESCRIPTION =
  "Encontre produtos para vender no TikTok Shop e receba um plano de gravação em 8 partes: abertura, cenas, roteiro, legenda, CTA e hashtags.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: "%s | TemTrend",
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: "TemTrend",
  category: "Produtividade e criação de conteúdo",
  keywords: [
    "TikTok Shop",
    "afiliados TikTok Shop",
    "produtos para vender",
    "roteiro para TikTok",
    "plano de gravação",
    "criador de conteúdo",
    "TemTrend",
  ],
  authors: [{ name: "TemTrend", url: SITE_URL }],
  creator: "TemTrend",
  publisher: "TemTrend",
  formatDetection: { email: false, address: false, telephone: false },
  appleWebApp: {
    capable: true,
    title: "TemTrend",
    statusBarStyle: "default",
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "/",
    siteName: "TemTrend",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "TemTrend" }],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: ["/opengraph-image"],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaff" },
    { media: "(prefers-color-scheme: dark)", color: "#08080a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth" className={`${onest.variable} ${bricolage.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className={onest.className}><RecoveryRedirect />{children}</body>
    </html>
  );
}
