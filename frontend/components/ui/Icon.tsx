import type { ReactNode, SVGProps } from "react";

/**
 * Conjunto único de ícones da plataforma.
 * Traço 1.8, pontas arredondadas, viewBox 24 e currentColor.
 */
export type IconName =
  | "alert-triangle"
  | "arrow-down"
  | "arrow-left"
  | "arrow-right"
  | "arrow-up-right"
  | "bell"
  | "bookmark"
  | "box"
  | "calendar"
  | "check"
  | "check-circle"
  | "chevron-down"
  | "chevron-right"
  | "circle"
  | "clock"
  | "compass"
  | "copy"
  | "dashboard"
  | "download"
  | "droplet"
  | "external-link"
  | "file-text"
  | "grid"
  | "home"
  | "image"
  | "layers"
  | "lock"
  | "log-out"
  | "message-square"
  | "minus"
  | "more-horizontal"
  | "moon"
  | "panel-left"
  | "pencil"
  | "percent"
  | "pie-chart"
  | "pix"
  | "plan"
  | "plus"
  | "production"
  | "refresh"
  | "search"
  | "settings"
  | "shirt"
  | "shopping-bag"
  | "smartphone"
  | "sparkles"
  | "star"
  | "sun"
  | "support"
  | "target"
  | "ticket"
  | "trash"
  | "trending-up"
  | "user"
  | "users"
  | "video"
  | "x";

const ICONS: Record<IconName, ReactNode> = {
  "alert-triangle": (
    <>
      <path d="M12 4 21 20H3L12 4Z" />
      <path d="M12 9v5M12 17.2h.01" />
    </>
  ),
  "arrow-down": (
    <>
      <path d="M12 4v13" />
      <path d="m6.5 11.5 5.5 5.5 5.5-5.5" />
      <path d="M5 20h14" />
    </>
  ),
  "arrow-left": (
    <>
      <path d="M19 12H5" />
      <path d="m11 6-6 6 6 6" />
    </>
  ),
  "arrow-right": (
    <>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </>
  ),
  "arrow-up-right": (
    <>
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </>
  ),
  bell: (
    <>
      <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 8.5h18C21 16 18 16 18 9Z" />
      <path d="M10 21h4" />
    </>
  ),
  bookmark: <path d="M7 4.5h10v15l-5-3-5 3v-15Z" />,
  box: (
    <>
      <path d="m21 8-9 5-9-5 9-5 9 5Z" />
      <path d="m3 8 9 5 9-5v8l-9 5-9-5V8Z" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15.5" rx="2.5" />
      <path d="M16 2.5v3.5M8 2.5v3.5M3.5 9.5h17" />
    </>
  ),
  check: <path d="m4.5 12.5 5 5 10-11" />,
  "check-circle": (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.5 12 2.3 2.3 4.7-5" />
    </>
  ),
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  "chevron-right": <path d="m9 6 6 6-6 6" />,
  circle: <circle cx="12" cy="12" r="8.5" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m16 8-2.5 5.5L8 16l2.5-5.5L16 8Z" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2.2" />
      <path d="M15.5 8.5V6.3A2.3 2.3 0 0 0 13.2 4H6.3A2.3 2.3 0 0 0 4 6.3v6.9a2.3 2.3 0 0 0 2.3 2.3h2.2" />
    </>
  ),
  dashboard: (
    <>
      <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12M7 10l5 5 5-5" />
      <path d="M5 21h14" />
    </>
  ),
  droplet: (
    <>
      <path d="M12 3c2.5 4.2 5 7 5 10a5 5 0 0 1-10 0c0-3 2.5-5.8 5-10Z" />
      <path d="M9 14c.4 1.2 1.4 2 3 2" />
    </>
  ),
  "external-link": (
    <>
      <path d="M14 3h7v7M10 14 21 3" />
      <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
    </>
  ),
  "file-text": (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6M8 13h8M8 17h5" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </>
  ),
  home: (
    <>
      <path d="m3 11 9-7 9 7v9H3Z" />
      <path d="M9 20v-6h6v6" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="9" cy="9.5" r="1.7" />
      <path d="m5 17.5 3.9-3.9a2 2 0 0 1 2.8 0l3.4 3.4" />
    </>
  ),
  layers: (
    <>
      <path d="M4 7.5 12 4l8 3.5-8 3.5-8-3.5Z" />
      <path d="m4 12.5 8 3.5 8-3.5" />
      <path d="m4 17 8 3.5 8-3.5" />
    </>
  ),
  "log-out": (
    <>
      <path d="M14 5.5V4.8A1.8 1.8 0 0 0 12.2 3H6.8A1.8 1.8 0 0 0 5 4.8v14.4A1.8 1.8 0 0 0 6.8 21h5.4a1.8 1.8 0 0 0 1.8-1.8v-.7" />
      <path d="M10 12h10M17 9l3 3-3 3" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10" width="15" height="10.5" rx="2.5" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      <path d="M12 14v2.5" />
    </>
  ),
  "message-square": (
    <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
  ),
  minus: <path d="M5 12h14" />,
  "more-horizontal": <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  moon: <path d="M20.5 14.3A8.5 8.5 0 0 1 9.7 3.5a8.5 8.5 0 1 0 10.8 10.8Z" />,
  "panel-left": (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
      <path d="M10 4.5v15M15.5 10 13 12l2.5 2" />
    </>
  ),
  pencil: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
    </>
  ),
  percent: (
    <>
      <path d="m5 19 14-14" />
      <circle cx="7.5" cy="7.5" r="2.5" />
      <circle cx="16.5" cy="16.5" r="2.5" />
    </>
  ),
  "pie-chart": (
    <>
      <path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5H12V3.5Z" />
      <path d="M14.5 2.6A8.5 8.5 0 0 1 21.4 9.5h-6.9V2.6Z" />
    </>
  ),
  pix: (
    <>
      <path d="m12 3 9 9-9 9-9-9 9-9Z" />
      <path d="m8 8 4 4 4-4M8 16l4-4 4 4" />
    </>
  ),
  plan: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="3" />
      <path d="M2 10h20" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  production: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="3" />
      <path d="m10 9 5 3-5 3V9Z" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11a8 8 0 0 0-13.7-5.2L4 8" />
      <path d="M4 4v4h4" />
      <path d="M4 13a8 8 0 0 0 13.7 5.2L20 16" />
      <path d="M20 20v-4h-4" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </>
  ),
  settings: (
    <>
      <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
      <circle cx="15" cy="6" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="17" cy="18" r="2" />
    </>
  ),
  shirt: <path d="m8 4-5 4 3 4 2-2v10h8V10l2 2 3-4-5-4-4 2z" />,
  "shopping-bag": (
    <>
      <path d="M6 8h12l1 12H5L6 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </>
  ),
  smartphone: (
    <>
      <rect x="6" y="2" width="12" height="20" rx="2" />
      <path d="M11 18h2" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 2.5l1.7 5.3 5.3 1.7-5.3 1.7L12 16.5l-1.7-5.3L5 9.5l5.3-1.7L12 2.5Z" />
      <path d="M18.5 15l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6Z" opacity=".55" />
    </>
  ),
  star: <path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.7l5.8-.8L12 3.6Z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
    </>
  ),
  support: (
    <>
      <path d="M20 11.5a8 8 0 1 0-3.1 6.3L21 19l-.8-3.2c.5-1.2.8-2.4.8-3.8Z" />
      <path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  ticket: (
    <>
      <path d="M4 8.5V6.8A1.8 1.8 0 0 1 5.8 5h12.4A1.8 1.8 0 0 1 20 6.8v1.7a2.5 2.5 0 0 0 0 7v1.7a1.8 1.8 0 0 1-1.8 1.8H5.8A1.8 1.8 0 0 1 4 17.2v-1.7a2.5 2.5 0 0 0 0-7Z" />
      <path d="M12 7v10" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9.5 7V5.4c0-.8.5-1.4 1.3-1.4h2.4c.8 0 1.3.6 1.3 1.4V7" />
      <path d="m6.5 7 .8 11.2a2 2 0 0 0 2 1.8h5.4a2 2 0 0 0 2-1.8L17.5 7" />
    </>
  ),
  "trending-up": (
    <>
      <path d="M3.5 16.5 9 11l3.5 3.5L20 7" />
      <path d="M15 7h5v5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  video: (
    <>
      <rect x="2" y="6" width="15" height="12" rx="2" />
      <path d="m17 10 5-3v10l-5-3" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6 6 18" />,
};

export default function Icon({
  name,
  size = 18,
  strokeWidth = 1.8,
  title,
  filled = false,
  className,
  ...props
}: Omit<SVGProps<SVGSVGElement>, "name" | "width" | "height" | "viewBox" | "fill" | "stroke"> & {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  title?: string;
  filled?: boolean;
}) {
  return (
    <svg
      {...props}
      className={className ? `tt-icon ${className}` : "tt-icon"}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={filled ? undefined : strokeWidth}
      strokeLinecap={filled ? undefined : "round"}
      strokeLinejoin={filled ? undefined : "round"}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {ICONS[name]}
    </svg>
  );
}
