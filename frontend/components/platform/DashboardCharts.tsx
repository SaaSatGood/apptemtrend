"use client";

type LineChartProps = {
  values: number[];
  labels: string[];
  emptyMessage?: string;
};

const WIDTH = 560;
const HEIGHT = 208;
const PAD = { top: 16, right: 16, bottom: 30, left: 44 };

function niceCeiling(value: number): number {
  if (value <= 4) return 4;
  return Math.ceil(value / 4) * 4;
}

/** Gráfico de linha leve, no mesmo desenho do painel de referência. */
export function LineChart({ values, labels, emptyMessage = "Nenhum dado no período" }: LineChartProps) {
  const innerWidth = WIDTH - PAD.left - PAD.right;
  const innerHeight = HEIGHT - PAD.top - PAD.bottom;
  const max = niceCeiling(Math.max(0, ...values));
  const hasData = values.some((value) => value > 0);
  const step = values.length > 1 ? innerWidth / (values.length - 1) : 0;

  const points = values.map((value, index) => {
    const x = values.length > 1 ? PAD.left + index * step : PAD.left + innerWidth / 2;
    const y = PAD.top + innerHeight - (value / max) * innerHeight;
    return [x, y] as const;
  });

  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = points.length
    ? `M ${points[0][0].toFixed(1)} ${(PAD.top + innerHeight).toFixed(1)} L ${points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L ")} L ${points[points.length - 1][0].toFixed(1)} ${(PAD.top + innerHeight).toFixed(1)} Z`
    : "";

  const ticks = [0, 1, 2, 3, 4].map((index) => Math.round((max / 4) * index));
  const labelStep = Math.max(1, Math.ceil(labels.length / 5));

  return (
    <div className="tt-chart">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Gráfico de evolução do conteúdo" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="tt-chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9eea6c" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#9eea6c" stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((tick) => {
          const y = PAD.top + innerHeight - (tick / max) * innerHeight;
          return (
            <g key={tick}>
              <line x1={PAD.left} y1={y} x2={WIDTH - PAD.right} y2={y} className="tt-chart-grid" />
              <text x={PAD.left - 10} y={y + 4} className="tt-chart-axis" textAnchor="end">{tick}</text>
            </g>
          );
        })}

        {hasData && area && <path d={area} fill="url(#tt-chart-fill)" />}
        {hasData && points.length > 1 && <polyline points={line} className="tt-chart-line" />}

        {hasData && points.map(([x, y], index) => (
          <circle
            key={index}
            cx={x}
            cy={y}
            r={index === points.length - 1 ? 4.5 : 2.4}
            className={index === points.length - 1 ? "tt-chart-dot is-last" : "tt-chart-dot"}
          />
        ))}

        {labels.map((label, index) => {
          if (index % labelStep !== 0 && index !== labels.length - 1) return null;
          const x = values.length > 1 ? PAD.left + index * step : PAD.left + innerWidth / 2;
          return <text key={`${label}-${index}`} x={x} y={HEIGHT - 10} className="tt-chart-axis" textAnchor="middle">{label}</text>;
        })}
      </svg>

      {!hasData && <p className="tt-chart-empty">{emptyMessage}</p>}
    </div>
  );
}
