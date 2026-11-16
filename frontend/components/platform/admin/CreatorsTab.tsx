"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Icon from "@/components/ui/Icon";
import { friendlyError } from "@/lib/api";
import { usePlatform } from "../store";
import Modal from "../Modal";
import styles from "../Admin.module.css";
import { adminGet, adminPatch, adminToken } from "./api";
import { fmtDay, fmtDateTime, formatCount, initials } from "./format";
import type { AdminCreator, AdminCreatorDetail } from "./types";
import { EmptyState, ErrorState, LoadingRows, SectionHeading } from "./ui";

const PLAN_LABEL: Record<string, string> = {
  free: "Grátis",
  pro: "Pro",
  essencial: "Essencial",
  scale: "Scale",
  enterprise: "Enterprise",
};

const DAY_MS = 24 * 60 * 60 * 1000;

type PlanFilter = "todos" | "pagos" | "vencendo" | "trial" | "gratis";

const PLAN_FILTERS: Array<{ value: PlanFilter; label: string }> = [
  { value: "todos", label: "Todos os planos" },
  { value: "pagos", label: "Com plano ativo" },
  { value: "vencendo", label: "Vence em 7 dias" },
  { value: "trial", label: "Em trial" },
  { value: "gratis", label: "Grátis" },
];

function isTrialing(creator: AdminCreator): boolean {
  return creator.plan_status === "trialing" && Boolean(creator.trial_ends_at) && Date.parse(String(creator.trial_ends_at)) > Date.now();
}

function planUntilDate(creator: AdminCreator): string | null {
  return creator.plan_until ?? (isTrialing(creator) ? creator.trial_ends_at ?? null : creator.current_period_end ?? null);
}

function planSummary(creator: AdminCreator): string {
  const plan = PLAN_LABEL[creator.plan ?? "free"] ?? creator.plan ?? "Grátis";
  const until = planUntilDate(creator);
  if (creator.plan_active) {
    if (creator.plan_status === "past_due") return `${plan} · pagamento pendente até ${fmtDay(until)}`;
    if (creator.plan_status === "canceled") return `${plan} · acesso até ${fmtDay(until)}`;
    return `${plan} · até ${fmtDay(until)}`;
  }
  if (isTrialing(creator)) return `Trial até ${fmtDay(until)}`;
  if (creator.plan_status === "past_due") return `${plan} · vencido em ${fmtDay(until)}`;
  return "Grátis";
}

function daysUntil(iso?: string | null): number | null {
  if (!iso) return null;
  const diff = Date.parse(iso) - Date.now();
  if (!Number.isFinite(diff)) return null;
  return Math.ceil(diff / DAY_MS);
}

export default function CreatorsTab({ token, onChanged }: { token?: string; onChanged?: () => void }) {
  const { toast } = usePlatform();
  const [creators, setCreators] = useState<AdminCreator[] | null>(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [planFilter, setPlanFilter] = useState<PlanFilter>("todos");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<AdminCreatorDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selected, setSelected] = useState<AdminCreator | null>(null);

  const [planOpen, setPlanOpen] = useState(false);
  const [planBusy, setPlanBusy] = useState(false);
  const [planMode, setPlanMode] = useState<"monthly" | "annual" | "custom">("monthly");
  const [customDays, setCustomDays] = useState("90");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(false);
      const result = await adminGet<AdminCreator[]>("/admin/creators?page=1&limit=100", token);
      setCreators(Array.isArray(result) ? result : []);
    } catch {
      setError(true);
    }
  }, [token]);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return (creators ?? []).filter((creator) => {
      const statusMatch = !status || creator.status === status;
      const termMatch =
        !term ||
        [creator.nome, creator.email, creator.user_id, ...(creator.nicho ?? [])].some((value) =>
          String(value ?? "").toLocaleLowerCase("pt-BR").includes(term),
        );
      if (!statusMatch || !termMatch) return false;
      const days = daysUntil(planUntilDate(creator));
      if (planFilter === "pagos") return creator.plan_active === true;
      if (planFilter === "vencendo") return creator.plan_active === true && days != null && days <= 7;
      if (planFilter === "trial") return isTrialing(creator);
      if (planFilter === "gratis") return creator.plan_active !== true && !isTrialing(creator);
      return true;
    });
  }, [creators, planFilter, query, status]);

  const summary = useMemo(() => {
    const list = creators ?? [];
    return {
      total: list.length,
      pagos: list.filter((creator) => creator.plan_active).length,
      vencendo: list.filter((creator) => {
        if (!creator.plan_active) return false;
        const days = daysUntil(planUntilDate(creator));
        return days != null && days <= 7;
      }).length,
      trial: list.filter(isTrialing).length,
    };
  }, [creators]);

  async function toggleCreator(creator: AdminCreator) {
    setBusyId(creator.id);
    try {
      const next = creator.status === "ativo" ? "bloqueado" : "ativo";
      await adminPatch(`/admin/creators/${creator.id}/status`, { status: next }, token);
      setCreators((current) =>
        (current ?? []).map((item) => (item.id === creator.id ? { ...item, status: next } : item)),
      );
      toast(next === "ativo" ? "Creator reativado." : "Creator bloqueado.");
    } catch (err) {
      toast(friendlyError(err, "Não conseguimos atualizar o creator."));
    } finally {
      setBusyId(null);
    }
  }

  async function openDetail(creator: AdminCreator) {
    setSelected(creator);
    setDetailOpen(true);
    setDetail(null);
    setDetailLoading(true);
    try {
      setDetail(await adminGet<AdminCreatorDetail>(`/admin/creators/${creator.id}`, token));
    } catch (err) {
      toast(friendlyError(err, "Não conseguimos abrir o creator."));
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }

  function openPlan(creator: AdminCreator) {
    setSelected(creator);
    setPlanMode(creator.plan_period === "annual" ? "annual" : "monthly");
    setCustomDays("90");
    setPlanOpen(true);
  }

  async function grantPlan() {
    if (!selected || planBusy) return;
    const days = planMode === "custom" ? Number(customDays) : planMode === "annual" ? 365 : 30;
    if (!Number.isFinite(days) || days < 1 || days > 730) {
      toast("Informe uma duração entre 1 e 730 dias.");
      return;
    }
    setPlanBusy(true);
    try {
      await adminPatch(`/admin/creators/${selected.id}/plan`, {
        plan: "pro",
        period: planMode === "annual" ? "annual" : "monthly",
        days,
      }, token);
      toast(`Pro concedido por ${days} dias.`);
      setPlanOpen(false);
      await load();
      onChanged?.();
    } catch (err) {
      toast(friendlyError(err, "Não conseguimos conceder o plano."));
    } finally {
      setPlanBusy(false);
    }
  }

  async function revokePlan() {
    if (!selected || planBusy) return;
    setPlanBusy(true);
    try {
      await adminPatch(`/admin/creators/${selected.id}/plan`, { plan: "free" }, token);
      toast("Plano removido. A conta voltou para o Grátis.");
      setPlanOpen(false);
      await load();
      onChanged?.();
    } catch (err) {
      toast(friendlyError(err, "Não conseguimos remover o plano."));
    } finally {
      setPlanBusy(false);
    }
  }

  async function deleteAccount() {
    if (!selected || deleteBusy) return;
    setDeleteBusy(true);
    try {
      const { requireApiUrl } = await import("@/lib/config");
      const accessToken = token ?? (await adminToken());
      const response = await fetch(`${requireApiUrl()}/admin/creators/${selected.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ confirm_email: deleteConfirm.trim() }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error?.message ?? "Não foi possível excluir a conta.");
      }
      toast("Conta excluída.");
      setDeleteOpen(false);
      setDetailOpen(false);
      setDeleteConfirm("");
      await load();
      onChanged?.();
    } catch (err) {
      toast(friendlyError(err, "Não foi possível excluir a conta."));
    } finally {
      setDeleteBusy(false);
    }
  }

  const usageTotals = useMemo(() => {
    const rows = detail?.usage ?? [];
    return rows.reduce(
      (total, row) => ({
        assistant: total.assistant + Number(row.assistant_calls ?? 0),
        kits: total.kits + Number(row.kit_calls ?? 0),
        support: total.support + Number(row.support_calls ?? 0),
        tokens: total.tokens + Number(row.total_tokens ?? 0),
      }),
      { assistant: 0, kits: 0, support: 0, tokens: 0 },
    );
  }, [detail]);

  const emailMatches = Boolean(
    selected?.email && deleteConfirm.trim().toLowerCase() === selected.email.trim().toLowerCase(),
  );

  return (
    <div className={styles.viewPanel}>
      <SectionHeading
        eyebrow="Comunidade"
        title="Creators cadastrados"
        description="Veja quem tem plano ativo, até quando vale e gerencie o acesso."
      />

      <div className={styles.creatorSummary}>
        <div><span>Total</span><strong>{formatCount(summary.total)}</strong></div>
        <div><span>Com plano ativo</span><strong>{formatCount(summary.pagos)}</strong></div>
        <div><span>Vence em 7 dias</span><strong>{formatCount(summary.vencendo)}</strong></div>
        <div><span>Em trial</span><strong>{formatCount(summary.trial)}</strong></div>
      </div>

      <div className={`${styles.toolbar} ${styles.creatorsToolbar}`}>
        <label className={styles.searchField}>
          <Icon name="search" size={18} />
          <input
            aria-label="Buscar creators"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nome, email, nicho ou ID"
          />
        </label>
        <select aria-label="Filtrar creators por status" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">Todos os status</option>
          <option value="ativo">Ativos</option>
          <option value="bloqueado">Bloqueados</option>
        </select>
        <select aria-label="Filtrar creators por plano" value={planFilter} onChange={(event) => setPlanFilter(event.target.value as PlanFilter)}>
          {PLAN_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      <div className={styles.listMeta}>
        <p>
          <strong>{formatCount(filtered.length)}</strong>{" "}
          {filtered.length === 1 ? "creator encontrado" : "creators encontrados"}
        </p>
      </div>

      {error && creators === null ? (
        <ErrorState message="Não foi possível carregar os creators." onRetry={() => void load()} />
      ) : creators === null ? (
        <LoadingRows count={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nenhum creator corresponde aos filtros."
          description="Tente outro nome, e-mail, status ou plano."
          action="Limpar filtros"
          onAction={() => { setQuery(""); setStatus(""); setPlanFilter("todos"); }}
        />
      ) : (
        <div className={styles.creatorList}>
          {filtered.map((creator) => {
            const days = daysUntil(planUntilDate(creator));
            const expiring = creator.plan_active && days != null && days <= 7;
            return (
              <article key={creator.id} className={styles.creatorRow}>
                <div className={styles.avatar}>{initials(creator.nome, creator.email)}</div>
                <div className={styles.creatorIdentity}>
                  <div>
                    <h3>{creator.nome || "Creator sem nome"}</h3>
                    <span className={creator.status === "ativo" ? styles.statusActive : styles.statusBlocked}>
                      {creator.status === "ativo" ? "Ativo" : "Bloqueado"}
                    </span>
                    <span className={`${styles.planBadge}${creator.plan_active ? ` ${styles.planBadgeActive}` : ""}`}>
                      {planSummary(creator)}
                    </span>
                    {expiring && <span className={styles.planBadgeWarn}>vence em {days === 0 ? "hoje" : `${days}d`}</span>}
                  </div>
                  <p>{creator.email || creator.user_id}</p>
                  <p className={styles.creatorMeta}>
                    Entrou em {fmtDay(creator.criado_em)}
                    {creator.plan_period ? ` · plano ${creator.plan_period === "annual" ? "anual" : "mensal"}` : ""}
                  </p>
                </div>
                <div className={styles.niches}>
                  {creator.nicho?.length
                    ? creator.nicho.map((niche) => <span key={niche}>{niche}</span>)
                    : <span>Sem nicho informado</span>}
                </div>
                <div className={styles.creatorActions}>
                  <button type="button" className={styles.detailAction} onClick={() => void openDetail(creator)}>
                    Detalhes
                  </button>
                  <button type="button" className={styles.planAction} onClick={() => openPlan(creator)}>
                    Plano
                  </button>
                  <button
                    type="button"
                    className={creator.status === "ativo" ? styles.blockAction : styles.activateAction}
                    onClick={() => void toggleCreator(creator)}
                    disabled={busyId === creator.id}
                  >
                    {busyId === creator.id ? "Aguarde…" : creator.status === "ativo" ? "Bloquear" : "Reativar"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {planOpen && selected && (
        <Modal titleId="admin-plan-title" busy={planBusy} onClose={() => { if (!planBusy) setPlanOpen(false); }}>
          <div className={styles.detailStack}>
            <p className="eyebrow">Plano do creator</p>
            <h2 id="admin-plan-title">{selected.nome || selected.email || "Creator"}</h2>
            <p className={styles.mutedText}>
              Situação atual: <strong>{planSummary(selected)}</strong>
            </p>

            <div className={styles.detailSection}>
              <h3>Conceder Pro</h3>
              <div className={styles.planOptions}>
                {([
                  ["monthly", "Mensal", "30 dias"],
                  ["annual", "Anual", "365 dias"],
                  ["custom", "Personalizado", "escolha os dias"],
                ] as const).map(([value, label, hint]) => (
                  <label key={value} className={`${styles.planOption}${planMode === value ? ` ${styles.planOptionActive}` : ""}`}>
                    <input
                      type="radio"
                      name="admin-plan-mode"
                      value={value}
                      checked={planMode === value}
                      onChange={() => setPlanMode(value)}
                    />
                    <span>
                      <strong>{label}</strong>
                      <small>{hint}</small>
                    </span>
                  </label>
                ))}
              </div>
              {planMode === "custom" && (
                <label className={styles.planDays}>
                  Dias de acesso
                  <input
                    type="number"
                    min={1}
                    max={730}
                    value={customDays}
                    onChange={(event) => setCustomDays(event.target.value)}
                  />
                </label>
              )}
              <p className={styles.mutedText}>
                A concessão vale na hora (o gating lê o plano do creator) e aparece em Assinaturas com origem
                “manual”. Nenhuma cobrança é criada no provedor.
              </p>
            </div>

            <div className={styles.formActions}>
              {selected.plan_active && (
                <button
                  className={styles.dangerGhost}
                  type="button"
                  onClick={() => void revokePlan()}
                  disabled={planBusy}
                >
                  Remover plano
                </button>
              )}
              <button className={styles.secondaryButton} type="button" onClick={() => setPlanOpen(false)} disabled={planBusy}>
                Cancelar
              </button>
              <button className={styles.primaryButton} type="button" onClick={() => void grantPlan()} disabled={planBusy}>
                {planBusy ? "Aplicando…" : "Conceder Pro"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {detailOpen && (
        <Modal titleId="admin-creator-detail" busy={false} onClose={() => setDetailOpen(false)}>
          <div className={styles.detailStack}>
            <p className="eyebrow">Ficha do creator</p>
            <h2 id="admin-creator-detail">
              {detail?.nome || (detail?.creator?.nome as string) || detail?.email || "Carregando…"}
            </h2>
            {detailLoading ? (
              <LoadingRows count={3} />
            ) : !detail ? (
              <p className={styles.mutedText}>Não foi possível carregar os dados deste creator.</p>
            ) : (
              <>
                <p className={styles.mutedText}>{detail.email || String(detail.creator.user_id)}</p>
                <dl className={styles.detailGrid}>
                  <div><dt>Plano</dt><dd>{PLAN_LABEL[String(detail.creator.plan ?? "free")] ?? "Grátis"}</dd></div>
                  <div><dt>Status do plano</dt><dd>{String(detail.creator.plan_status ?? "—")}</dd></div>
                  <div><dt>Período</dt><dd>{detail.creator.plan_period === "annual" ? "Anual" : "Mensal"}</dd></div>
                  <div><dt>Válido até</dt><dd>{fmtDay(detail.creator.current_period_end as string | null)}</dd></div>
                  <div><dt>Roteiros</dt><dd>{formatCount(detail.counts.content_kits)}</dd></div>
                  <div><dt>Conversas</dt><dd>{formatCount(detail.counts.discovery_sessions)}</dd></div>
                  <div><dt>Produções</dt><dd>{formatCount(detail.counts.creator_content)}</dd></div>
                  <div><dt>Suporte</dt><dd>{formatCount(detail.counts.support_tickets)}</dd></div>
                </dl>

                <div className={styles.detailSection}>
                  <h3>Uso de IA · 30 dias</h3>
                  <dl className={styles.detailInline}>
                    <div><dt>Buscas</dt><dd>{formatCount(usageTotals.assistant)}</dd></div>
                    <div><dt>Roteiros</dt><dd>{formatCount(usageTotals.kits)}</dd></div>
                    <div><dt>Suporte</dt><dd>{formatCount(usageTotals.support)}</dd></div>
                    <div><dt>Tokens</dt><dd>{formatCount(usageTotals.tokens, true)}</dd></div>
                  </dl>
                </div>

                <div className={styles.detailSection}>
                  <h3>Assinaturas</h3>
                  {detail.subscriptions.length === 0 ? (
                    <p className={styles.mutedText}>Nenhuma assinatura registrada.</p>
                  ) : (
                    <ul className={styles.detailList}>
                      {detail.subscriptions.map((sub) => (
                        <li key={sub.id}>
                          <strong>{PLAN_LABEL[sub.plan] ?? sub.plan}</strong>
                          <span>{sub.status} · {sub.period === "annual" ? "anual" : "mensal"} · até {fmtDay(sub.current_period_end)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className={styles.detailSection}>
                  <h3>Conversas recentes</h3>
                  {detail.sessions.length === 0 ? (
                    <p className={styles.mutedText}>Nenhuma conversa no Descobrir.</p>
                  ) : (
                    <ul className={styles.detailList}>
                      {detail.sessions.map((session) => (
                        <li key={session.id}>
                          <strong>{session.title || "Conversa sem título"}</strong>
                          <span>{fmtDateTime(session.updated_at)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className={styles.detailSection}>
                  <h3>Atendimentos</h3>
                  {detail.tickets.length === 0 ? (
                    <p className={styles.mutedText}>Nenhum atendimento aberto.</p>
                  ) : (
                    <ul className={styles.detailList}>
                      {detail.tickets.map((ticket) => (
                        <li key={ticket.id}>
                          <strong>{ticket.subject}</strong>
                          <span>{ticket.status} · {fmtDateTime(ticket.last_message_at)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className={`${styles.detailSection} ${styles.dangerZone}`}>
                  <h3>Excluir conta</h3>
                  <p className={styles.mutedText}>
                    Remove o acesso, o perfil e todo o conteúdo deste creator (roteiros, conversas, produções e
                    atendimentos). Não pode ser desfeito.
                  </p>
                  {!deleteOpen ? (
                    <button className={styles.dangerGhost} type="button" onClick={() => setDeleteOpen(true)}>
                      <Icon name="trash" size={15} /> Excluir conta
                    </button>
                  ) : (
                    <div className={styles.deleteConfirm}>
                      <label>
                        Digite <strong>{selected?.email || detail.email}</strong> para confirmar
                        <input
                          type="email"
                          value={deleteConfirm}
                          onChange={(event) => setDeleteConfirm(event.target.value)}
                          placeholder="email da conta"
                          autoComplete="off"
                        />
                      </label>
                      <div className={styles.formActions}>
                        <button
                          className={styles.secondaryButton}
                          type="button"
                          onClick={() => { setDeleteOpen(false); setDeleteConfirm(""); }}
                          disabled={deleteBusy}
                        >
                          Cancelar
                        </button>
                        <button
                          className={styles.dangerButton}
                          type="button"
                          onClick={() => void deleteAccount()}
                          disabled={deleteBusy || !emailMatches}
                        >
                          {deleteBusy ? "Excluindo…" : "Excluir definitivamente"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
            <div className={styles.formActions}>
              <button className={styles.secondaryButton} type="button" onClick={() => setDetailOpen(false)}>
                Fechar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
