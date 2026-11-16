"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Icon from "@/components/ui/Icon";
import styles from "../Admin.module.css";
import { adminGet } from "./api";
import { fmtDay, formatCount, formatMoney } from "./format";
import type { AdminBillingSummary, AdminCreator, AdminSubscription } from "./types";
import { EmptyState, ErrorState, LoadingRows, SectionHeading } from "./ui";

const STATUS_LABEL: Record<string, string> = {
  active: "Ativa",
  trialing: "Trial",
  past_due: "Pendente",
  canceled: "Cancelada",
  pending: "Aguardando",
  failed: "Falhou",
};

const STATUS_FILTERS = [
  { value: "", label: "Todos os status" },
  { value: "active", label: "Ativas" },
  { value: "trialing", label: "Trial" },
  { value: "past_due", label: "Pagamento pendente" },
  { value: "canceled", label: "Canceladas" },
];

const MAX_ROWS = 100;

function providerLabel(provider?: string | null): string {
  if (!provider) return "—";
  if (provider === "manual") return "Manual (admin)";
  if (provider === "asaas") return "Asaas";
  if (provider === "abacatepay") return "AbacatePay";
  return provider;
}

export default function BillingTab({ token }: { token?: string }) {
  const [summary, setSummary] = useState<AdminBillingSummary | null>(null);
  const [items, setItems] = useState<AdminSubscription[] | null>(null);
  const [plans, setPlans] = useState<AdminCreator[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState(false);
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  // Relógio fixo do render: evita Date.now() no JSX e mantém a tabela estável.
  const [nowTs] = useState(() => Date.now());
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    if (!token) return;
    const id = ++requestRef.current;
    setError(false);
    try {
      const [summaryResult, subs, creators] = await Promise.all([
        adminGet<AdminBillingSummary>("/admin/billing/summary", token),
        adminGet<{ items: AdminSubscription[]; total: number }>(
          `/admin/billing/subscriptions?page=1&limit=${MAX_ROWS}`,
          token,
        ),
        adminGet<AdminCreator[]>("/admin/creators?page=1&limit=100", token),
      ]);
      if (id !== requestRef.current) return;
      setSummary(summaryResult);
      setItems(subs.items ?? []);
      setTotal(subs.total ?? subs.items?.length ?? 0);
      setPlans(Array.isArray(creators) ? creators : []);
    } catch {
      if (id === requestRef.current) setError(true);
    }
  }, [token]);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return (items ?? []).filter((sub) => {
      const statusMatch = !status || sub.status === status;
      const queryMatch =
        !term ||
        [sub.creator_nome, sub.creator_email, sub.plan_label, sub.provider].some((value) =>
          String(value ?? "").toLocaleLowerCase("pt-BR").includes(term),
        );
      return statusMatch && queryMatch;
    });
  }, [items, query, status]);

  // Quem realmente tem acesso pago agora (fonte: creators, não o espelho do provedor).
  const activePlans = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return (plans ?? [])
      .filter((creator) => creator.plan_active === true)
      .filter(
        (creator) =>
          !term ||
          [creator.nome, creator.email].some((value) =>
            String(value ?? "").toLocaleLowerCase("pt-BR").includes(term),
          ),
      )
      .sort((a, b) => String(a.plan_until ?? "").localeCompare(String(b.plan_until ?? "")));
  }, [plans, query]);

  return (
    <div className={styles.viewPanel}>
      <SectionHeading
        eyebrow="Receita"
        title="Assinaturas"
        description="Planos ativos, pagamentos pendentes e mudanças agendadas — espelho do provedor de pagamento."
        action={
          <button className={styles.secondaryButton} type="button" onClick={() => void load()}>
            <Icon name="refresh" size={16} /> Atualizar
          </button>
        }
      />

      {error && !summary ? (
        <ErrorState message="Não foi possível carregar as assinaturas." onRetry={() => void load()} />
      ) : (
        <>
          <div className={styles.creatorSummary}>
            <div><span>Planos ativos</span><strong>{formatCount(summary?.active)}</strong></div>
            <div><span>Vencem em 7 dias</span><strong>{formatCount(summary?.expiring_7d)}</strong></div>
            <div><span>Em trial</span><strong>{formatCount(summary?.trialing)}</strong></div>
            <div><span>MRR estimado</span><strong>{summary ? formatMoney((summary.mrr_cents ?? 0) / 100) : "—"}</strong></div>
          </div>

          <p className={styles.planMix}>
            Carteira: <strong>{formatCount(summary?.creators_total)}</strong> creators ·{" "}
            <strong>{formatCount(summary?.past_due)}</strong> com pagamento pendente ·{" "}
            <strong>{formatCount(summary?.canceled)}</strong> cancelados com acesso ativo ·{" "}
            <strong>{formatCount(summary?.pending)}</strong> cobranças aguardando ·{" "}
            <strong>{formatCount(summary?.failed)}</strong> falhas no provedor
          </p>

          <div className={`${styles.toolbar} ${styles.billingToolbar}`}>
            <label className={styles.searchField}>
              <Icon name="search" size={18} />
              <input
                aria-label="Buscar assinaturas"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por creator, e-mail ou plano"
              />
            </label>
            <select aria-label="Filtrar assinaturas por status" value={status} onChange={(event) => setStatus(event.target.value)}>
              {STATUS_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className={styles.listMeta}>
            <p>
              <strong>{formatCount(activePlans.length)}</strong>{" "}
              {activePlans.length === 1 ? "plano com acesso ativo" : "planos com acesso ativo"}
            </p>
          </div>

          {plans === null ? (
            <LoadingRows count={2} />
          ) : activePlans.length === 0 ? (
            <EmptyState
              title="Nenhum plano pago ativo agora."
              description="Conceda um plano na aba Creators ou aguarde um checkout aprovado."
            />
          ) : (
            <div className={`${styles.tableWrap} ${styles.plansTable}`}>
              <table className={styles.subsTable}>
                <thead>
                  <tr>
                    <th scope="col">Creator</th>
                    <th scope="col">Plano</th>
                    <th scope="col">Período</th>
                    <th scope="col">Válido até</th>
                    <th scope="col">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {activePlans.map((creator) => {
                    const days = creator.plan_until
                      ? Math.ceil((Date.parse(creator.plan_until) - nowTs) / 86400000)
                      : null;
                    return (
                      <tr key={creator.id}>
                        <td>
                          <strong>{creator.nome || "Creator sem nome"}</strong>
                          <span className={styles.subMeta}>{creator.email || creator.user_id}</span>
                        </td>
                        <td>{creator.plan === "pro" ? "Pro" : creator.plan ?? "—"}</td>
                        <td>{creator.plan_period === "annual" ? "Anual" : "Mensal"}</td>
                        <td>{fmtDay(creator.plan_until)}</td>
                        <td>
                          <span className={days != null && days <= 7 ? styles.planBadgeWarn : styles.statusActive}>
                            {days == null ? "sem data" : days <= 0 ? "vence hoje" : `${days} ${days === 1 ? "dia" : "dias"}`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className={styles.listMeta}>
            <p>
              <strong>{formatCount(filtered.length)}</strong>{" "}
              {filtered.length === 1 ? "assinatura listada" : "assinaturas listadas"}
              {total > MAX_ROWS ? ` · mostrando as ${MAX_ROWS} mais recentes de ${formatCount(total)}` : ""}
            </p>
          </div>

          {items === null ? (
            <LoadingRows count={4} />
          ) : filtered.length === 0 ? (
            <EmptyState
              title={query || status ? "Nenhuma assinatura corresponde aos filtros." : "Nenhuma assinatura ainda."}
              description={
                query || status
                  ? "Ajuste a busca ou o status para ver a carteira completa."
                  : "Quando um creator assinar, o plano aparece aqui com status, valor e próxima cobrança."
              }
              action={query || status ? "Limpar filtros" : undefined}
              onAction={query || status ? () => { setQuery(""); setStatus(""); } : undefined}
            />
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.subsTable}>
                <thead>
                  <tr>
                    <th scope="col">Creator</th>
                    <th scope="col">Plano</th>
                    <th scope="col">Período</th>
                    <th scope="col">Origem</th>
                    <th scope="col">Status</th>
                    <th scope="col">Valor</th>
                    <th scope="col">Válido até</th>
                    <th scope="col">Agendado</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((sub) => (
                    <tr key={sub.id}>
                      <td>
                        <strong>{sub.creator_nome || "Creator sem nome"}</strong>
                        <span className={styles.subMeta}>{sub.creator_email || ""}</span>
                      </td>
                      <td>{sub.plan_label}</td>
                      <td>{sub.period === "annual" ? "Anual" : "Mensal"}</td>
                      <td>{providerLabel(sub.provider)}</td>
                      <td>
                        <span
                          className={
                            sub.status === "active"
                              ? styles.statusActive
                              : sub.status === "past_due" || sub.status === "failed"
                                ? styles.statusBlocked
                                : styles.subNeutral
                          }
                        >
                          {STATUS_LABEL[sub.status] ?? sub.status}
                        </span>
                      </td>
                      <td>{sub.amount_cents != null ? formatMoney(sub.amount_cents / 100) : "—"}</td>
                      <td>{fmtDay(sub.current_period_end)}</td>
                      <td>{sub.pending_plan_label ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
