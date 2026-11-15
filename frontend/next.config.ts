import type { NextConfig } from "next";

const apiOrigin = (() => {
  try { return new URL(process.env.NEXT_PUBLIC_API_URL ?? "").origin; } catch { return ""; }
})();
const supabaseOrigin = (() => {
  try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin; } catch { return ""; }
})();
const connectSrc = ["'self'", apiOrigin, supabaseOrigin, "https://*.supabase.co", "wss://*.supabase.co"].filter(Boolean).join(" ");
const scriptSrc = process.env.NODE_ENV === "development"
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "object-src 'none'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https://images.unsplash.com https://images.pexels.com https://s.500fd.com https://*.supabase.co",
  "media-src 'self' https://videos.pexels.com",
  `connect-src ${connectSrc}`,
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // O indicador de dev do Next cobre o rodapé da sidebar (menu da conta).
  devIndicators: false,
  // O Playwright acessa 127.0.0.1 enquanto o dev server pode ouvir em localhost.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // Rotas antigas (/app/...) continuam válidas para links salvos, e-mails e
  // campanhas: redireciona em definitivo para a estrutura atual.
  async redirects() {
    return [
      { source: "/app", destination: "/descobrir", permanent: true },
      { source: "/app/:path*", destination: "/:path*", permanent: true },
    ];
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "images.pexels.com" },
      { protocol: "https", hostname: "s.500fd.com" },
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
  async headers() {
    const preconnect = [
      "https://s.500fd.com",
      "https://images.unsplash.com",
      "https://images.pexels.com",
      "https://videos.pexels.com",
    ].map((origin) => `<${origin}>; rel=preconnect`).join(", ");
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Link", value: preconnect },
        ],
      },
    ];
  },
};

export default nextConfig;
