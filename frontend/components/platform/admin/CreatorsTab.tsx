"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Icon from "@/components/ui/Icon";
import { friendlyError } from "@/lib/api";
import { usePlatform } from "../store";
import Modal from "../Modal";
import styles from "../Admin.module.css";
import { adminGet, adminPatch } from "./api";
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

function planLabel(creator: AdminCreator): string {
  const plan = PLAN_LABEL[creator.plan ?? "free"] ?? creator.plan ?? "Grátis";
  if (creator.plan_status === "trialing") return `${plan} · trial`;
  if (creator.plan_status === "past_due") return `${plan} · pendente`;
  if (creator.plan_status === "canceled") return `${plan} · cancelado`;
  return plan;
}

export default function CreatorsTab({ token }: { token?: string }) {
  const { toast } = usePlatform();
  const [creators, setCreators] = useState<AdminCreator[] | null>(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<AdminCreatorDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

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
      const queryMatch =
        !term ||
        [creator.nome, creator.email, creator.user_id, ...(creator.nicho ?? [])].some((value) =>
          String(value ?? "").toLocaleLowerCase("pt-BR").includes(term),
        );
      return statusMatch && queryMatch;
    });
  }, [creators, query, status]);

  const summary = useMemo(() => {
    const list = creators ?? [];
    return {
      total: list.length,
      ativos: list.filter((creator) => creator.status === "ativo").length,
      bloqueados: list.filter((creator) => creator.status === "bloqueado").length,
      trial: list.filter((creator) => creator.plan_status === "trialing").length,
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

  return (
    <div className={styles.viewPanel}>
      <SectionHeading
        eyebrow="Comunidade"
        title="Creators cadastrados"
        description="Encontre contas, entenda o uso e gerencie o acesso."
      />

      <div className={styles.creatorSummary}>
        <div><span>Total</span><strong>{formatCount(summary.total)}</strong></div>
        <div><span>Ativos</span><strong>{formatCount(summary.ativos)}</strong></div>
        <div><span>Bloqueados</span><strong>{formatCount(summary.bloqueados)}</strong></div>
        <div><span>Em trial</span><strong>{formatCount(summary.trial)}</strong></div>
      </div>

      <div className={`${styles.toolbar} ${styles.creatorToolbar}`}>
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
          description="Tente outro nome, e-mail ou status."
          action="Limpar filtros"
          onAction={() => { setQuery(""); setStatus(""); }}
        />
      ) : (
        <div className={styles.creatorList}>
          {filtered.map((creator) => (
            <article key={creator.id} className={styles.creatorRow}>
              <div className={styles.avatar}>{initials(creator.nome, creator.email)}</div>
              <div className={styles.creatorIdentity}>
                <div>
                  <h3>{creator.nome || "Creator sem nome"}</h3>
                  <span className={creator.status === "ativo" ? styles.statusActive : styles.statusBlocked}>
                    {creator.status === "ativo" ? "Ativo" : "Bloqueado"}
                  </span>
                  <span className={styles.planBadge}>{planLabel(creator)}</span>
                </div>
                <p>{creator.email || creator.user_id}</p>
                <p className={styles.creatorMeta}>
                  Entrou em {fmtDay(creator.criado_em)}
                  {creator.current_period_end ? ` · renova em ${fmtDay(creator.current_period_end)}` : ""}
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
                <button
                  type="button"
                  className={creator.status === "ativo" ? styles.blockAction : styles.activateAction}
                  onClick={() => void toggleCreator(creator)}
                  disabled={busyId === creator.id}
                >
                  {busyId === creator.id ? "Aguarde…" : creator.status === "ativo" ? "Bloquear acesso" : "Reativar acesso"}
                </button>
              </div>
            </article>
          ))}
        </div>
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
                  <div><dt>Renovação</dt><dd>{fmtDay(detail.creator.current_period_end as string | null)}</dd></div>
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
