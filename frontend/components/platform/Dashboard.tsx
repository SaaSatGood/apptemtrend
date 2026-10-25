"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Icon from "@/components/ui/Icon";
import type { CreatorContent } from "@/lib/types";
import { usePlatform } from "./store";
import Opportunities from "./Opportunities";
import { LineChart } from "./DashboardCharts";

type PeriodKey = "hoje" | "mes" | "d30" | "ano" | "tudo" | "custom";
type StatusKey = "salvo" | "em_producao" | "gravado" | "publicado";

const DAY = 86_400_000;

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "mes", label: "Este mês" },
  { key: "d30", label: "Últimos 30 dias" },
  { key: "ano", label: "Último ano" },
  { key: "tudo", label: "Todo o período" },
  { key: "custom", label: "Personalizar" },
];

const STATUS_META: { key: StatusKey; label: string; color: string }[] = [
  { key: "salvo", label: "Salvos", color: "#cfe4a6" },
  { key: "em_producao", label: "Em produção", color: "#a9e86f" },
  { key: "gravado", label: "Gravados", color: "#6fd44f" },
  { key: "publicado", label: "Publicados", color: "#2f8f3f" },
];

function startOfToday(): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.getTime();
}

function startOfMonth(): number {
  const now = new Date();
  now.setDate(1);
  now.setHours(0, 0, 0, 0);
  return now.getTime();
}

function periodBounds(key: PeriodKey, custom: { from: string; to: string }): { from: number | null; to: number | null } {
  const now = Date.now();
  if (key === "hoje") return { from: startOfToday(), to: now };
  if (key === "mes") return { from: startOfMonth(), to: now };
  if (key === "d30") return { from: now - 30 * DAY, to: now };
  if (key === "ano") return { from: now - 365 * DAY, to: now };
  if (key === "tudo") return { from: null, to: null };
  const from = custom.from ? Date.parse(`${custom.from}T00:00:00`) : NaN;
  const to = custom.to ? Date.parse(`${custom.to}T23:59:59`) : NaN;
  return {
    from: Number.isFinite(from) ? from : null,
    to: Number.isFinite(to) ? to : null,
  };
}

function inRange(item: CreatorContent, from: number | null, to: number | null): boolean {
  if (from === null && to === null) return true;
  const stamp = Date.parse(item.atualizado_em || "");
  if (!Number.isFinite(stamp)) return false;
  if (from !== null && stamp < from) return false;
  if (to !== null && stamp > to) return false;
  return true;
}

function countByStatus(items: CreatorContent[]): Record<StatusKey, number> {
  const counts: Record<StatusKey, number> = { salvo: 0, em_producao: 0, gravado: 0, publicado: 0 };
  items.forEach((item) => {
    if (item.status in counts) counts[item.status] += 1;
  });
  return counts;
}

interface Bucket {
  label: string;
  total: number;
  published: number;
}

function buildBuckets(items: CreatorContent[], from: number | null, to: number | null): Bucket[] {
  const end = to ?? Date.now();
  const stamps = items
    .map((item) => Date.parse(item.atualizado_em || ""))
    .filter((value) => Number.isFinite(value));
  const earliest = stamps.length ? Math.min(...stamps) : end - 29 * DAY;
  const start = from ?? (earliest <= end ? earliest : end - 29 * DAY);
  const buckets: Bucket[] = [];

  const fill = (index: number, published: boolean) => {
    if (index < 0 || index >= buckets.length) return;
    buckets[index].total += 1;
    if (published) buckets[index].published += 1;
  };

  if (end - start <= 32 * DAY) {
    const anchor = new Date(start);
    anchor.setHours(0, 0, 0, 0);
    const days = Math.min(45, Math.max(1, Math.round((end - anchor.getTime()) / DAY) + 1));
    for (let index = 0; index < days; index += 1) {
      const day = new Date(anchor.getTime() + index * DAY);
      buckets.push({
        label: `${String(day.getDate()).padStart(2, "0")}/${String(day.getMonth() + 1).padStart(2, "0")}`,
        total: 0,
        published: 0,
      });
    }
    items.forEach((item) => {
      const stamp = Date.parse(item.atualizado_em || "");
      if (!Number.isFinite(stamp)) return;
      fill(Math.floor((stamp - anchor.getTime()) / DAY), item.status === "publicado");
    });
    return buckets;
  }

  const anchor = new Date(start);
  anchor.setDate(1);
  anchor.setHours(0, 0, 0, 0);
  const last = new Date(end);
  const months = Math.min(
    12,
    Math.max(1, (last.getFullYear() - anchor.getFullYear()) * 12 + (last.getMonth() - anchor.getMonth()) + 1)
  );
  for (let index = 0; index < months; index += 1) {
    const month = new Date(anchor.getFullYear(), anchor.getMonth() + index, 1);
    buckets.push({
      label: month.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
      total: 0,
      published: 0,
    });
  }
  items.forEach((item) => {
    const stamp = Date.parse(item.atualizado_em || "");
    if (!Number.isFinite(stamp)) return;
    const date = new Date(stamp);
    fill((date.getFullYear() - anchor.getFullYear()) * 12 + (date.getMonth() - anchor.getMonth()), item.status === "publicado");
  });
  return buckets;
}

/** Decoração dos blocos de indicador (ilustração própria, no spirit da referência). */
function MetricArt({ kind }: { kind: "contents" | "published" }) {
  return (
    <span className={`tt-dash-art is-${kind}`} aria-hidden="true">
      <svg viewBox="0 0 96 96" role="presentation">
        <defs>
          <linearGradient id={`tt-art-${kind}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e6f9da" />
            <stop offset="55%" stopColor="#9eea6c" />
            <stop offset="100%" stopColor="#58c411" />
          </linearGradient>
        </defs>
        <ellipse cx="48" cy="80" rx="30" ry="7" fill="#1f4647" opacity=".16" />
        <rect x="26" y="26" width="44" height="44" rx="14" fill={`url(#tt-art-${kind})`} />
        {kind === "contents" ? (
          <g stroke="#1f4647" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none">
            <path d="M36 40h24M36 48h24M36 56h14" />
          </g>
        ) : (
          <g stroke="#1f4647" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" fill="none">
            <path d="m37 48 8 8 15-16" />
          </g>
        )}
      </svg>
    </span>
  );
}

export default function Dashboard() {
  const { productions, productionsLoading } = usePlatform();
  const [period, setPeriod] = useState<PeriodKey>("tudo");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [statusFilter, setStatusFilter] = useState<"todos" | StatusKey>("todos");
  const [evolution, setEvolution] = useState<"publicados" | "total">("publicados");

  const bounds = periodBounds(period, custom);
  const from = bounds.from;
  const to = bounds.to;

  const filtered = useMemo(
    () => productions.filter((item) => inRange(item, from, to)),
    [productions, from, to]
  );

  const total = productions.length;
  const allCounts = useMemo(() => countByStatus(productions), [productions]);
  const periodCounts = useMemo(() => countByStatus(filtered), [filtered]);
  const loading = productionsLoading && productions.length === 0;

  const buckets = useMemo(() => buildBuckets(filtered, from, to), [filtered, from, to]);
  const chartLabels = buckets.map((bucket) => bucket.label);
  const performance = buckets.map((bucket) => bucket.total);

  let running = 0;
  const cumulativeTotal = buckets.map((bucket) => { running += bucket.total; return running; });
  running = 0;
  const cumulativePublished = buckets.map((bucket) => { running += bucket.published; return running; });

  const statusItems = STATUS_META
    .filter((item) => statusFilter === "todos" || item.key === statusFilter)
    .map((item) => ({ ...item, count: periodCounts[item.key] }));
  const statusTotal = statusItems.reduce((sum, item) => sum + item.count, 0);
  const completion = total ? Math.round((allCounts.publicado / total) * 100) : 0;

  const metrics = [
    { label: "Total de conteúdos", value: loading ? "…" : String(total), icon: "layers" as const },
    { label: "Novos no período", value: loading ? "…" : String(filtered.length), icon: "arrow-down" as const },
    { label: "Em produção", value: loading ? "…" : String(periodCounts.em_producao), icon: "refresh" as const },
    { label: "Prontos para publicar", value: loading ? "…" : String(periodCounts.gravado), icon: "ticket" as const },
    { label: "Taxa de publicação", value: loading ? "…" : `${completion}%`, icon: "percent" as const },
  ];

  const active = [...productions]
    .filter((item) => item.status !== "publicado")
    .sort((a, b) => (b.atualizado_em || "").localeCompare(a.atualizado_em || ""))[0] || null;

  const periodLabel = PERIODS.find((item) => item.key === period)?.label ?? "Todo o período";

  return (
    <section className="tt-dashboard" aria-labelledby="tt-dashboard-title">
      <h1 id="tt-dashboard-title" className="sr-only">Dashboard</h1>

      <div className="tt-dash-filters" role="group" aria-label="Periodo do painel">
        {PERIODS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`tt-dash-filter${period === item.key ? " is-active" : ""}`}
            aria-pressed={period === item.key}
            onClick={() => setPeriod(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {period === "custom" && (
        <div className="tt-dash-custom">
          <label>
            De
            <input
              type="date"
              value={custom.from}
              max={custom.to || undefined}
              onChange={(event) => setCustom((current) => ({ ...current, from: event.target.value }))}
            />
          </label>
          <label>
            Até
            <input
              type="date"
              value={custom.to}
              min={custom.from || undefined}
              onChange={(event) => setCustom((current) => ({ ...current, to: event.target.value }))}
            />
          </label>
          <p>Filtra os indicadores, os gráficos e a produção do período escolhido.</p>
        </div>
      )}

      <section className="tt-dash-hero" aria-label="Indicadores principais">
        <article className="tt-dash-hero-block">
          <p className="tt-dash-hero-label">Conteúdos criados</p>
          <p className="tt-dash-hero-value">
            {loading ? "…" : filtered.length}
            <span className="tt-dash-hero-tag">{periodLabel}</span>
          </p>
          <MetricArt kind="contents" />
        </article>
        <article className="tt-dash-hero-block">
          <p className="tt-dash-hero-label">Publicados</p>
          <p className="tt-dash-hero-value">
            {loading ? "…" : periodCounts.publicado}
            <span className="tt-dash-hero-tag">no ar</span>
          </p>
          <MetricArt kind="published" />
        </article>
      </section>

      <section className="tt-dash-metrics" aria-label="Resumo do conteúdo">
        {metrics.map((metric) => (
          <article key={metric.label} className="tt-dash-metric">
            <p className="tt-dash-metric-label">
              <Icon name={metric.icon} size={16} />
              {metric.label}
            </p>
            <strong>{metric.value}</strong>
          </article>
        ))}
      </section>

      <div className="tt-dash-charts">
        <section className="tt-dash-card" aria-labelledby="tt-chart-performance">
          <header className="tt-dash-card-head">
            <h2 id="tt-chart-performance">
              <Icon name="trending-up" size={16} />
              Desempenho de conteúdo
            </h2>
          </header>
          <LineChart
            values={performance}
            labels={chartLabels}
            emptyMessage="Nenhum conteúdo criado no período"
          />
        </section>

        <section className="tt-dash-card" aria-labelledby="tt-chart-evolution">
          <header className="tt-dash-card-head">
            <h2 id="tt-chart-evolution">
              <Icon name="trending-up" size={16} />
              Evolução
            </h2>
            <div className="tt-dash-switch" role="group" aria-label="Métrica da evolução">
              <button
                type="button"
                className={evolution === "publicados" ? "is-active" : ""}
                aria-pressed={evolution === "publicados"}
                onClick={() => setEvolution("publicados")}
              >
                Publicados
              </button>
              <button
                type="button"
                className={evolution === "total" ? "is-active" : ""}
                aria-pressed={evolution === "total"}
                onClick={() => setEvolution("total")}
              >
                Total
              </button>
            </div>
          </header>
          <LineChart
            values={evolution === "publicados" ? cumulativePublished : cumulativeTotal}
            labels={chartLabels}
            emptyMessage="Nada acumulado no período"
          />
        </section>
      </div>

      <div className="tt-dash-bottom">
        <section className="tt-dash-card tt-dash-resume" aria-label="Retomar produção">
          {active ? (
            <Opportunities />
          ) : loading ? (
            <div className="tt-dash-skeleton" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          ) : total > 0 ? (
            <div className="tt-dash-empty">
              <p className="tt-dash-empty-kicker">Tudo em dia</p>
              <h3>Seu conteúdo está no ar.</h3>
              <p>Os vídeos publicados ficam salvos na produção para consulta e reaproveitamento.</p>
              <Link className="tt-dash-empty-cta" href="/app/producao">Ver produção <Icon name="arrow-up-right" size={14} /></Link>
            </div>
          ) : (
            <div className="tt-dash-empty">
              <p className="tt-dash-empty-kicker">Primeiro passo</p>
              <h3>Seu primeiro conteúdo começa aqui.</h3>
              <p>Escolha um produto, gere o roteiro e a TemTrend organiza o resto com você.</p>
              <Link className="tt-dash-empty-cta" href="/app/descobrir">Encontrar produto <Icon name="arrow-up-right" size={14} /></Link>
            </div>
          )}
        </section>

        <section className="tt-dash-card tt-dash-status" aria-labelledby="tt-status-title">
          <header className="tt-dash-card-head">
            <h2 id="tt-status-title">
              <Icon name="pie-chart" size={16} />
              Status dos roteiros
            </h2>
            <label className="tt-dash-select">
              <span className="sr-only">Filtrar por status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as "todos" | StatusKey)}
              >
                <option value="todos">Todos</option>
                {STATUS_META.map((item) => (
                  <option key={item.key} value={item.key}>{item.label}</option>
                ))}
              </select>
            </label>
          </header>

          {statusTotal > 0 ? (
            <>
              <div className="tt-dash-bar" role="img" aria-label="Distribuição dos roteiros por status">
                {statusItems.filter((item) => item.count > 0).map((item) => (
                  <span
                    key={item.key}
                    style={{ width: `${(item.count / statusTotal) * 100}%`, background: item.color }}
                  />
                ))}
              </div>
              <ul className="tt-dash-status-list">
                {statusItems.map((item) => (
                  <li key={item.key}>
                    <span className="tt-dash-status-dot" style={{ background: item.color }} aria-hidden="true" />
                    <span>{item.label}</span>
                    <strong>{item.count}</strong>
                    <small>{statusTotal ? Math.round((item.count / statusTotal) * 100) : 0}%</small>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="tt-dash-empty is-compact">
              <p className="tt-dash-empty-kicker">Sem dados</p>
              <h3>Nenhum roteiro neste período.</h3>
              <p>Assim que você salvar um produto, o status aparece aqui.</p>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
