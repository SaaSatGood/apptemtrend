"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Icon from "@/components/ui/Icon";
import { usePlatform } from "../store";
import styles from "../Admin.module.css";
import { adminGet } from "./api";
import {
  eventLabel,
  formatCount,
  metricNumber,
} from "./format";
import type {
  AdminAiUsage,
  AdminDashboardMetrics,
  AdminFunnelEvent,
  AdminView,
} from "./types";
import type { AdminSupportTicket } from "@/lib/types";
import { ErrorState, LoadingRows, SectionHeading } from "./ui";

const PROVIDER_LABEL: Record<string, string> = {
  gemini: "Google Gemini",
  openrouter: "OpenRouter",
  opencode: "OpenCode",
};

const METRIC_CARDS: Array<{ key: string; label: string; detail: string }> = [
  { key: "total_creators", label: "Creators", detail: "Contas cadastradas" },
  { key: "creators_ativos", label: "Creators ativos", detail: "Com acesso à plataforma" },
  { key: "total_content_kits", label: "Conteúdos", detail: "Roteiros gerados" },
  { key: "oportunidades_salvas", label: "Oportunidades salvas", detail: "Produtos em consideração" },
  { key: "conteudos_publicados", label: "Publicações", detail: "Conteúdos concluídos" },
  { key: "suporte_abertos", label: "Suporte", detail: "Conversas aguardando resposta" },
  { key: "assinaturas_ativas", label: "Assinaturas", detail: "Planos pagos ativos" },
  { key: "leads_novos", label: "Leads novos", detail: "Contatos da landing de marcas" },
];

export default function OverviewTab({
  token,
  onOpen,
}: {
  token?: string;
  onOpen: (view: AdminView) => void;
}) {
  const { toast } = usePlatform();
  const [metrics, setMetrics] = useState<AdminDashboardMetrics | null>(null);
  const [metricsError, setMetricsError] = useState(false);
  const [funnel, setFunnel] = useState<AdminFunnelEvent[] | null>(null);
  const [funnelError, setFunnelError] = useState(false);
  const [ai, setAi] = useState<AdminAiUsage | null>(null);
  const [aiError, setAiError] = useState(false);
  const [tickets, setTickets] = useState<AdminSupportTicket[] | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    const tasks = [
      adminGet<AdminDashboardMetrics>("/admin/dashboard", token)
        .then((data) => { setMetrics(data); setMetricsError(false); })
        .catch(() => setMetricsError(true)),
      adminGet<{ events: AdminFunnelEvent[] }>("/admin/analytics/funnel?days=30", token)
        .then((data) => { setFunnel(data.events ?? []); setFunnelError(false); })
        .catch(() => setFunnelError(true)),
      adminGet<AdminAiUsage>("/admin/ai-usage?days=14", token)
        .then((data) => { setAi(data); setAiError(false); })
        .catch(() => setAiError(true)),
      adminGet<{ items: AdminSupportTicket[] }>("/admin/support/tickets?page=1&limit=3", token)
        .then((data) => setTickets(data.items ?? []))
        .catch(() => setTickets([])),
    ];
    await Promise.all(tasks);
  }, [token]);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  const aiToday = ai?.today ?? null;
  const aiNumbers = {
    classify: Number(aiToday?.classify_calls ?? aiToday?.classifyCalls ?? metrics?.ai_classify_calls ?? 0),
    generate: Number(aiToday?.generate_calls ?? aiToday?.generateCalls ?? metrics?.ai_generate_calls ?? 0),
    classifyTokens: Number(aiToday?.classify_tokens ?? aiToday?.classifyTokens ?? metrics?.ai_classify_tokens ?? 0),
    generateTokens: Number(aiToday?.generate_tokens ?? aiToday?.generateTokens ?? metrics?.ai_generate_tokens ?? 0),
  };
  const provider = ai?.config.provider ?? "—";
  const providerLabel = PROVIDER_LABEL[provider] ?? provider;
  const model = ai?.config.model ?? "—";

  const catalog = useMemo(
    () => ({
      total: metricNumber(metrics, "total_produtos"),
      ativos: metricNumber(metrics, "produtos_ativos"),
      pausados: metricNumber(metrics, "produtos_pausados"),
      destaque: metricNumber(metrics, "produtos_destaque"),
    }),
    [metrics],
  );

  const creators = useMemo(
    () => ({
      total: metricNumber(metrics, "total_creators"),
      ativos: metricNumber(metrics, "creators_ativos"),
      bloqueados: metricNumber(metrics, "creators_bloqueados"),
      trial: metricNumber(metrics, "creators_trial"),
    }),
    [metrics],
  );

  const support = useMemo(
    () => ({
      abertos: metricNumber(metrics, "suporte_abertos"),
      respondidos: metricNumber(metrics, "suporte_respondidos"),
    }),
    [metrics],
  );

  const topEvents = (funnel ?? []).slice(0, 6);
  const maxEvent = Math.max(1, ...topEvents.map((event) => Number(event.total) || 0));
  const activeRate = creators.total ? Math.round((creators.ativos / creators.total) * 100) : 0;

  return (
    <div className={styles.viewPanel}>
      <SectionHeading
        eyebrow="Agora"
        title="Resumo da plataforma"
        description="Indicadores essenciais para priorizar as próximas ações."
        action={
          <button className={styles.secondaryButton} type="button" onClick={() => { void load(); toast("Indicadores atualizados."); }}>
            <Icon name="refresh" size={16} /> Atualizar painel
          </button>
        }
      />

      {metricsError && !metrics ? (
        <ErrorState message="Não foi possível carregar as métricas." onRetry={() => void load()} />
      ) : (
        <div className={styles.metricGrid} aria-live="polite">
          {metrics
            ? METRIC_CARDS.map((metric, index) => (
                <article key={metric.key} className={styles.metricCard}>
                  <span className={styles.metricIndex}>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{formatCount(metrics[metric.key])}</strong>
                  <h3>{metric.label}</h3>
                  <p>{metric.detail}</p>
                </article>
              ))
            : Array.from({ length: METRIC_CARDS.length }).map((_, index) => (
                <div className={styles.metricSkeleton} key={index} aria-hidden="true" />
              ))}
        </div>
      )}

      <div className={styles.overviewGrid}>
        <article className={styles.healthCard}>
          <div className={styles.cardHeading}>
            <div>
              <span>Catálogo</span>
              <h2>Produtos e curadoria</h2>
            </div>
            <button type="button" onClick={() => onOpen("products")}>Abrir catálogo</button>
          </div>
          <div className={styles.progressBlock}>
            <div>
              <strong>{formatCount(catalog.ativos)}</strong>
              <span>de {formatCount(catalog.total)} produtos ativos na busca</span>
            </div>
            <div className={styles.progressTrack}>
              <i style={{ width: `${catalog.total ? (catalog.ativos / catalog.total) * 100 : 0}%` }} />
            </div>
          </div>
          <dl className={styles.healthList}>
            <div><dt>Pausados</dt><dd className={catalog.pausados ? styles.attention : ""}>{formatCount(catalog.pausados)}</dd></div>
            <div><dt>Em destaque</dt><dd>{formatCount(catalog.destaque)}</dd></div>
            <div><dt>Conteúdos por produto</dt><dd>{formatCount(metrics?.total_content_kits)}</dd></div>
          </dl>
        </article>

        <article className={styles.healthCard}>
          <div className={styles.cardHeading}>
            <div>
              <span>Comunidade</span>
              <h2>Creators com acesso</h2>
            </div>
            <button type="button" onClick={() => onOpen("creators")}>Gerenciar</button>
          </div>
          <div className={styles.progressBlock}>
            <div>
              <strong>{activeRate}%</strong>
              <span>das contas estão ativas</span>
            </div>
            <div className={styles.progressTrack}><i style={{ width: `${activeRate}%` }} /></div>
          </div>
          <dl className={styles.healthList}>
            <div><dt>Ativos</dt><dd>{formatCount(creators.ativos)}</dd></div>
            <div><dt>Bloqueados</dt><dd className={creators.bloqueados ? styles.attention : ""}>{formatCount(creators.bloqueados)}</dd></div>
            <div><dt>Com plano ativo</dt><dd>{formatCount(metrics?.planos_ativos)}</dd></div>
            <div><dt>Planos vencendo (7d)</dt><dd className={metricNumber(metrics, "planos_vencendo") > 0 ? styles.attention : ""}>{formatCount(metrics?.planos_vencendo)}</dd></div>
            <div><dt>Em trial</dt><dd>{formatCount(creators.trial)}</dd></div>
          </dl>
        </article>

        <article className={`${styles.healthCard} ${styles.aiCard}`}>
          <div className={styles.cardHeading}>
            <div>
              <span>Uso de IA · hoje</span>
              <h2>Consumo operacional</h2>
            </div>
            <i>{providerLabel} · {model}</i>
          </div>
          <dl className={styles.aiMetrics}>
            <div><dt>Classificações</dt><dd>{formatCount(aiNumbers.classify)}</dd></div>
            <div><dt>Gerações</dt><dd>{formatCount(aiNumbers.generate)}</dd></div>
            <div><dt>Tokens de classificação</dt><dd>{formatCount(aiNumbers.classifyTokens, true)}</dd></div>
            <div><dt>Tokens de geração</dt><dd>{formatCount(aiNumbers.generateTokens, true)}</dd></div>
          </dl>
          <p className={styles.aiFootnote}>
            {aiError ? "Não foi possível ler o consumo persistido — exibindo contadores em memória." : `Fonte: ${ai?.today.store === "database" ? "banco" : "memória"} · últimos 14 dias no detalhamento.`}
            <button type="button" onClick={() => onOpen("ai")}>Ver detalhamento</button>
          </p>
        </article>

        <article className={styles.healthCard}>
          <div className={styles.cardHeading}>
            <div>
              <span>Funil · 30 dias</span>
              <h2>Eventos de produto</h2>
            </div>
            <button type="button" onClick={() => void load()}>Atualizar</button>
          </div>
          {funnelError ? (
            <p className={styles.mutedText}>Não foi possível carregar o funil agora.</p>
          ) : funnel === null ? (
            <LoadingRows count={3} />
          ) : topEvents.length === 0 ? (
            <p className={styles.mutedText}>Sem eventos no período — o funil aparece quando houver navegação registrada.</p>
          ) : (
            <ul className={styles.funnelBars}>
              {topEvents.map((event) => (
                <li key={event.event_name}>
                  <span>{eventLabel(event.event_name)}</span>
                  <div><i style={{ width: `${Math.max(4, (Number(event.total) / maxEvent) * 100)}%` }} /></div>
                  <strong>{formatCount(event.total)}</strong>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className={styles.healthCard}>
          <div className={styles.cardHeading}>
            <div>
              <span>Atendimento</span>
              <h2>Suporte</h2>
            </div>
            <button type="button" onClick={() => onOpen("support")}>Abrir fila</button>
          </div>
          <div className={styles.progressBlock}>
            <div>
              <strong>{formatCount(support.abertos)}</strong>
              <span>{support.abertos === 1 ? "conversa aguardando resposta" : "conversas aguardando resposta"}</span>
            </div>
          </div>
          <dl className={styles.healthList}>
            <div><dt>Respondidas</dt><dd>{formatCount(support.respondidos)}</dd></div>
            <div><dt>Em aberto</dt><dd>{formatCount(support.abertos)}</dd></div>
            <div><dt>Total de tickets</dt><dd>{formatCount(metrics?.suporte_total)}</dd></div>
          </dl>
          {tickets && tickets.length > 0 && (
            <ul className={styles.overviewTickets}>
              {tickets.map((ticket) => (
                <li key={ticket.id}>
                  <button type="button" onClick={() => onOpen("support")}>
                    <strong>{ticket.subject}</strong>
                    <span>{ticket.creator_nome || ticket.creator_email || "Creator"}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className={styles.healthCard}>
          <div className={styles.cardHeading}>
            <div>
              <span>Comercial</span>
              <h2>Leads de marca</h2>
            </div>
            <button type="button" onClick={() => onOpen("leads")}>Ver leads</button>
          </div>
          <div className={styles.progressBlock}>
            <div>
              <strong>{formatCount(metrics?.leads_novos)}</strong>
              <span>leads aguardando primeiro contato</span>
            </div>
          </div>
          <dl className={styles.healthList}>
            <div><dt>Total recebido</dt><dd>{formatCount(metrics?.total_leads)}</dd></div>
            <div><dt>Qualificados</dt><dd>{formatCount(metrics?.leads_qualificados)}</dd></div>
            <div><dt>Origem</dt><dd>Landing de marcas</dd></div>
          </dl>
        </article>
      </div>
    </div>
  );
}
