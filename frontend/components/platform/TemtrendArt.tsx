/**
 * Arte de fundo da marca: ondas em meio-tom e sol suave usados no painel
 * de acesso. Compartilhada com o splash para a entrada no dashboard ter
 * a mesma linguagem visual do login.
 */
export default function TemtrendArt({
  idPrefix = "tt-art",
  className = "tt-auth-art-svg",
}: {
  idPrefix?: string;
  className?: string;
}) {
  const ref = (name: string) => `url(#${idPrefix}-${name})`;
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <svg
      className={className}
      viewBox="0 0 760 900"
      preserveAspectRatio="xMidYMax slice"
      focusable="false"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id("ink")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b6cf5" />
          <stop offset=".48" stopColor="#6d28d9" />
          <stop offset="1" stopColor="#4a2bc0" />
        </linearGradient>
        <radialGradient id={id("glow")} cx=".7" cy=".22" r=".72">
          <stop offset="0" stopColor="#fff" stopOpacity=".9" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id("sun")} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#8b6cf5" stopOpacity=".4" />
          <stop offset="1" stopColor="#6d28d9" stopOpacity=".14" />
        </radialGradient>
        <linearGradient id={id("fade")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" />
          <stop offset=".55" stopColor="#4a4a4a" />
          <stop offset="1" stopColor="#fff" />
        </linearGradient>
        <pattern id={id("dots")} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(9)">
          <circle cx="2.2" cy="2.2" r="1.5" fill="#4a2bc0" fillOpacity=".5" />
        </pattern>
        <pattern id={id("dots-fine")} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(9)">
          <circle cx="1.5" cy="1.5" r=".9" fill="#6d28d9" fillOpacity=".42" />
        </pattern>
        <pattern id={id("dots-light")} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(-6)">
          <circle cx="2" cy="2" r="1.2" fill="#fff" fillOpacity=".38" />
        </pattern>
        <mask id={id("dots-fade")}>
          <rect width="760" height="900" fill={ref("fade")} />
        </mask>
        <clipPath id={id("sun-clip")}>
          <circle cx="620" cy="322" r="214" />
        </clipPath>
        <clipPath id={id("wave-back")}>
          <path d="M0 604c92-44 168-48 250-20 90 31 148 22 220-18 78-44 152-46 230-10 24 12 44 22 60 26v318H0Z" />
        </clipPath>
        <clipPath id={id("wave-mid")}>
          <path d="M0 690c80-44 156-54 232-26 84 31 140 28 216-10 80-40 156-42 236-4 32 16 58 26 76 28v222H0Z" />
        </clipPath>
        <clipPath id={id("wave-front")}>
          <path d="M0 776c74-40 148-50 226-22 80 28 140 30 218-2 78-32 152-34 228-4 32 13 64 22 88 24v128H0Z" />
        </clipPath>
      </defs>

      <rect width="760" height="900" fill={ref("glow")} />

      <g fill="none" stroke="#6d28d9">
        <circle cx="620" cy="322" r="214" strokeOpacity=".1" />
        <circle cx="620" cy="322" r="268" strokeOpacity=".06" />
        <circle cx="620" cy="322" r="322" strokeOpacity=".04" />
      </g>

      <circle cx="620" cy="322" r="214" fill={ref("sun")} />
      <g clipPath={ref("sun-clip")} mask={ref("dots-fade")}>
        <circle cx="620" cy="322" r="214" fill={ref("dots")} opacity=".7" />
      </g>

      <g className="tt-auth-wave is-back">
        <g transform="translate(-30 0) scale(1.12 1)">
          <path d="M0 604c92-44 168-48 250-20 90 31 148 22 220-18 78-44 152-46 230-10 24 12 44 22 60 26v318H0Z" fill="#d9ccf9" opacity=".75" />
          <g clipPath={ref("wave-back")} mask={ref("dots-fade")}>
            <rect width="760" height="900" fill={ref("dots-fine")} />
          </g>
          <path d="M0 604c92-44 168-48 250-20 90 31 148 22 220-18 78-44 152-46 230-10 24 12 44 22 60 26" fill="none" stroke="#fff" strokeWidth="1.2" strokeOpacity=".32" />
        </g>
      </g>

      <g className="tt-auth-wave is-mid">
        <g transform="translate(-40 0) scale(1.16 1)">
          <path d="M0 690c80-44 156-54 232-26 84 31 140 28 216-10 80-40 156-42 236-4 32 16 58 26 76 28v222H0Z" fill={ref("ink")} opacity=".36" />
          <g clipPath={ref("wave-mid")} mask={ref("dots-fade")}>
            <rect width="760" height="900" fill={ref("dots")} />
          </g>
        </g>
      </g>

      <g className="tt-auth-wave is-front">
        <g transform="translate(-70 0) scale(1.22 1)">
          <path d="M0 776c74-40 148-50 226-22 80 28 140 30 218-2 78-32 152-34 228-4 32 13 64 22 88 24v128H0Z" fill={ref("ink")} />
          <g clipPath={ref("wave-front")} mask={ref("dots-fade")}>
            <rect width="760" height="900" fill={ref("dots-light")} />
          </g>
          <path d="M0 776c74-40 148-50 226-22 80 28 140 30 218-2 78-32 152-34 228-4 32 13 64 22 88 24" fill="none" stroke="#fff" strokeWidth="1.2" strokeOpacity=".32" />
        </g>
      </g>

      <g fill="#6d28d9">
        <circle cx="176" cy="262" r="5" fillOpacity=".22" />
        <circle cx="646" cy="536" r="7" fillOpacity=".18" />
        <circle cx="96" cy="470" r="3.5" fillOpacity=".28" />
      </g>
    </svg>
  );
}
