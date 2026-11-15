import type { Metadata } from "next";

export const SITE_NAME = "TemTrend";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.temtrend.com";
export const DEFAULT_OG_IMAGE = "/opengraph-image";

type PageMetadataInput = {
  /** Título sem o sufixo da marca; o template do layout raiz adiciona "| TemTrend". */
  title: string;
  description: string;
  /** Caminho canônico, sempre começando por "/". */
  path: string;
  /** Use quando o título já contém a marca (home e páginas absolutas). */
  absoluteTitle?: boolean;
  noindex?: boolean;
};

/**
 * Metadados padronizados de uma página: canonical, Open Graph e Twitter.
 * A imagem OG é gerada no build (`/opengraph-image`).
 */
export function pageMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
  noindex = false,
}: PageMetadataInput): Metadata {
  const fullTitle = absoluteTitle ? title : `${title} | ${SITE_NAME}`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: "pt_BR",
      url: path,
      siteName: SITE_NAME,
      title: fullTitle,
      description,
      images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: SITE_NAME }],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [DEFAULT_OG_IMAGE],
    },
    ...(noindex
      ? { robots: { index: false, follow: false, nocache: true } }
      : {}),
  };
}
