"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Icon from "@/components/ui/Icon";
import styles from "../Admin.module.css";
import { adminGet } from "./api";
import { fmtShortDay, formatCount } from "./format";
import type { AdminAiUsage } from "./types";
import { ErrorState, LoadingRows, SectionHeading } from "./ui";

const PROVIDER_LABEL: Record<string, string> = {
  gemini: "Google Gemini",
  openrouter: "OpenRouter",
  opencode: "OpenCode",
};

function todayKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default function AiTab({ token }: { token?: string }) {
  const [data, setData] = useState<AdminAiUsage | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(false);
    try {
      setData(await adminGet<AdminAiUsage>("/admin/ai-usage?days=14", token));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  const usage = useMemo(() => data?.usage ?? [], [data]);
  const metrics = useMemo(() => data?.series ?? [], [data]);

  // O gráfico usa o consumo por usuário (sempre gravado pelas cotas). Quando a
  // tabela diária de métricas existir, ela complementa a leitura.
  const timeline = useMemo(() => {
    type Day = { day: string; calls: number; tokens: number; classify: number; generate: number };
    const byDay = new Map<string, Day>();
    const fromUsage = new Set<string>();
    for (const row of usage) {
      byDay.set(row.usage_date, {
        day: row.usage_date,
        calls: Number(row.assistant_calls ?? 0) + Number(row.kit_calls ?? 0) + Number(row.support_calls ?? 0),
        tokens: Number(row.total_tokens ?? 0),
        classify: 0,
        generate: 0,
      });
      fromUsage.add(row.usage_date);
    }
    for (const row of metrics) {
      const entry = byDay.get(row.usage_date) ?? {
        day: row.usage_date,
        calls: 0,
        tokens: 0,
        classify: 0,
        generate: 0,
      };
      entry.classify = Number(row.classify_calls ?? 0);
      entry.generate = Number(row.generate_calls ?? 0);
      // Sem linha de consumo por usuário, a métrica é a única fonte de tokens.
      if (!fromUsage.has(row.usage_date)) {
        entry.tokens = Number(row.classify_tokens ?? 0) + Number(row.generate_tokens ?? 0);
      }
      if (entry.calls === 0) entry.calls = entry.classify + entry.generate;
      byDay.set(row.usage_date, entry);
    }
    return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
  }, [metrics, usage]);

  const usageTotals = useMemo(
    () =>
      usage.reduce(
        (acc, row) => ({
          assistant: acc.assistant + Number(row.assistant_calls ?? 0),
          kits: acc.kits + Number(row.kit_calls ?? 0),
          support: acc.support + Number(row.support_calls ?? 0),
          tokens: acc.tokens + Number(row.total_tokens ?? 0),
        }),
        { assistant: 0, kits: 0, support: 0, tokens: 0 },
      ),
    [usage],
  );

  const metricsTotals = useMemo(
    () =>
      metrics.reduce(
        (acc, row) => ({
          classify: acc.classify + Number(row.classify_calls ?? 0),
          generate: acc.generate + Number(row.generate_calls ?? 0),
          retries: acc.retries + Number(row.generate_retries ?? 0),
          cacheHits: acc.cacheHits + Number(row.classify_cache_hits ?? 0),
        }),
        { classify: 0, generate: 0, retries: 0, cacheHits: 0 },
      ),
    [metrics],
  );

  const today = data?.today ?? null;
  const todayUsage = usage.find((row) => row.usage_date === todayKey());
  const provider = data?.config.provider ?? "—";
  const model = data?.config.model ?? "—";
  const quotas = data?.config.quotas;
  const maxCalls = Math.max(1, ...timeline.map((row) => row.calls));

  const todayCalls = todayUsage
    ? Number(todayUsage.assistant_calls ?? 0) + Number(todayUsage.kit_calls ?? 0) + Number(todayUsage.support_calls ?? 0)
    : Number(today?.classify_calls ?? 0) + Number(today?.generate_calls ?? 0);
  const todayTokens = todayUsage
    ? Number(todayUsage.total_tokens ?? 0)
    : Number(today?.classify_tokens ?? 0) + Number(today?.generate_tokens ?? 0);

  return (
    <div className={styles.viewPanel}>
      <SectionHeading
        eyebrow="Operação"
        title="Uso de IA"
        description="Consumo real do provedor, cotas vigentes e histórico diário."
        action={
          <button className={styles.secondaryButton} type="button" onClick={() => void load()} disabled={loading}>
            <Icon name="refresh" size={16} /> {loading ? "Atualizando…" : "Atualizar"}
          </button>
        }
      />

      {error && !data ? (
        <ErrorState message="Não foi possível carregar o uso de IA." onRetry={() => void load()} />
      ) : loading && !data ? (
        <LoadingRows count={4} />
      ) : (
        <>
          <div className={styles.aiHeader}>
            <div>
              <span>Provedor ativo</span>
              <strong>{PROVIDER_LABEL[provider] ?? provider}</strong>
              <small>{model}</small>
            </div>
            <div>
              <span>Cota persistida em</span>
              <strong>{data?.config.quota_store === "database" ? "Banco de dados" : "Memória"}</strong>
              <small>{data?.today.store === "database" ? "Leitura do banco" : "Contadores em memória"}</small>
            </div>
            <div>
              <span>Billing</span>
              <strong>{data?.config.billing_enabled ? "Ativo" : "Desligado"}</strong>
              <small>{data?.config.billing_enabled ? "Checkout disponível" : "Sem checkout no app"}</small>
            </div>
          </div>

          <div className={styles.creatorSummary}>
            <div><span>Chamadas hoje</span><strong>{formatCount(todayCalls)}</strong></div>
            <div><span>Buscas no assistente</span><strong>{formatCount(todayUsage?.assistant_calls ?? today?.classify_calls)}</strong></div>
            <div><span>Roteiros gerados</span><strong>{formatCount(todayUsage?.kit_calls ?? today?.generate_calls)}</strong></div>
            <div><span>Tokens hoje</span><strong>{formatCount(todayTokens, true)}</strong></div>
          </div>

          <div className={styles.aiLayout}>
            <article className={`${styles.healthCard} ${styles.aiChartCard}`}>
              <div className={styles.cardHeading}>
                <div>
                  <span>Últimos 14 dias</span>
                  <h2>Chamadas por dia</h2>
                </div>
                <i>{formatCount(timeline.reduce((sum, row) => sum + row.calls, 0))} no período</i>
              </div>
              {timeline.length === 0 ? (
                <p className={styles.aiFootnote}>
                  Sem métricas persistidas no período. As chamadas de hoje aparecem acima pelos contadores do processo.
                </p>
              ) : (
                <ul className={styles.aiChart} aria-label="Chamadas de IA por dia">
                  {timeline.map((row) => (
                    <li key={row.day}>
                      <div className={styles.aiBarTrack}>
                        <i style={{ height: `${Math.max(3, (row.calls / maxCalls) * 100)}%` }} />
                      </div>
                      <span>{fmtShortDay(row.day)}</span>
                      <strong>{formatCount(row.calls)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className={styles.healthCard}>
              <div className={styles.cardHeading}>
                <div>
                  <span>Período</span>
                  <h2>Totais acumulados</h2>
                </div>
              </div>
              <dl className={styles.detailInline}>
                <div><dt>Buscas</dt><dd>{formatCount(usageTotals.assistant)}</dd></div>
                <div><dt>Roteiros</dt><dd>{formatCount(usageTotals.kits)}</dd></div>
                <div><dt>Suporte</dt><dd>{formatCount(usageTotals.support)}</dd></div>
                <div><dt>Tokens</dt><dd>{formatCount(usageTotals.tokens || metricsTotals.classify + metricsTotals.generate, true)}</dd></div>
              </dl>
              <div className={styles.detailSection}>
                <h3>Qualidade das gerações</h3>
                <dl className={styles.healthList}>
                  <div><dt>Classificações registradas</dt><dd>{formatCount(metricsTotals.classify)}</dd></div>
                  <div><dt>Gerações registradas</dt><dd>{formatCount(metricsTotals.generate)}</dd></div>
                  <div><dt>Retries</dt><dd>{formatCount(metricsTotals.retries)}</dd></div>
                  <div><dt>Cache hits</dt><dd>{formatCount(metricsTotals.cacheHits)}</dd></div>
                </dl>
              </div>
              <div className={styles.detailSection}>
                <h3>Cotas por usuário</h3>
                <dl className={styles.healthList}>
                  <div><dt>Buscas no assistente / dia</dt><dd>{formatCount(quotas?.ASSISTANT_PER_DAY)}</dd></div>
                  <div><dt>Roteiros / dia</dt><dd>{formatCount(quotas?.KIT_PER_DAY)}</dd></div>
                  <div><dt>Suporte / dia</dt><dd>{formatCount(quotas?.SUPPORT_PER_DAY)}</dd></div>
                  <div><dt>Intervalo mínimo entre roteiros</dt><dd>{Math.round((quotas?.FORCE_NEW_COOLDOWN_MS ?? 0) / 1000)}s</dd></div>
                </dl>
              </div>
            </article>
          </div>

          {timeline.length > 0 && (
            <div className={`${styles.tableWrap} ${styles.aiTable}`}>
              <table className={styles.subsTable}>
                <thead>
                  <tr>
                    <th scope="col">Dia</th>
                    <th scope="col">Buscas</th>
                    <th scope="col">Roteiros</th>
                    <th scope="col">Suporte</th>
                    <th scope="col">Tokens</th>
                    <th scope="col">Classificações</th>
                    <th scope="col">Gerações</th>
                  </tr>
                </thead>
                <tbody>
                  {[...timeline].reverse().map((row) => {
                    const usageRow = usage.find((item) => item.usage_date === row.day);
                    return (
                      <tr key={row.day}>
                        <td>{fmtShortDay(row.day)}</td>
                        <td>{formatCount(usageRow?.assistant_calls)}</td>
                        <td>{formatCount(usageRow?.kit_calls)}</td>
                        <td>{formatCount(usageRow?.support_calls)}</td>
                        <td>{formatCount(row.tokens, true)}</td>
                        <td>{formatCount(row.classify)}</td>
                        <td>{formatCount(row.generate)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
