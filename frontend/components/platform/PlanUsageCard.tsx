"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { displayPlanName } from "@/lib/plan-display";
import { SESSIONS_CHANGED_EVENT } from "@/lib/session-events";
import { resolveSession } from "@/lib/supabase";
import { PLAN_USAGE_CHANGED_EVENT } from "@/lib/usage-events";
import type { BillingSubscriptionSummary } from "@/lib/types";
import { usePlatform } from "./store";

type UsageMeterProps = {
  label: string;
  used: number;
  limit: number;
  period: "day" | "week" | "month";
};

/** Barra 0–100%. Mostra só a porcentagem; a quantidade fica no backend. */
function UsageMeter({ label, used, limit, period }: UsageMeterProps) {
  const safeLimit = Math.max(0, limit);
  const safeUsed = Math.min(Math.max(0, used), safeLimit);
  const percent = safeLimit > 0 ? Math.min(100, Math.round((safeUsed / safeLimit) * 100)) : 100;
  const state = percent >= 100 ? " is-full" : percent >= 70 ? " is-low" : "";
  const resetLabel = period === "day"
    ? "Renova todo dia"
    : period === "week"
      ? "Renova toda segunda"
      : "Renova todo mês";

  return (
    <div className={`tt-usage${state}`}>
      <div className="tt-usage-head">
        <span>{label}</span>
        <b>{percent}%</b>
      </div>
      <div
        className="tt-usage-track"
        role="progressbar"
        aria-label={`${label}: ${percent}% do limite usado`}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${percent}% do limite usado`}
      >
        <span className="tt-usage-fill" style={{ width: `${percent}%` }} />
      </div>
      <small className="tt-usage-rest">
        {percent >= 100 ? `Limite atingido · ${resetLabel.toLowerCase()}` : resetLabel}
      </small>
    </div>
  );
}

/** Cartão do plano na sidebar: nome, consumo do período e CTA de upgrade. */
export default function PlanUsageCard() {
  const pathname = usePathname() || "/descobrir";
  const { me, session } = usePlatform();
  const [billing, setBilling] = useState<BillingSubscriptionSummary | null>(null);
  const token = session?.access_token;

  const load = useCallback(async () => {
    try {
      const active = token ? session : await resolveSession();
      if (!active?.access_token) return;
      const summary = await api<BillingSubscriptionSummary>("/billing/subscription", active.access_token);
      if (summary?.enabled) setBilling(summary);
    } catch {
      // O cartão cai no estado do perfil: o plano aparece, o consumo fica oculto.
    }
  }, [session, token]);

  useEffect(() => {
    queueMicrotask(() => { void load(); });
  }, [load, pathname]);

  // Uma busca nova ou um roteiro gerado consome cota sem trocar de rota.
  useEffect(() => {
    const refresh = () => { void load(); };
    window.addEventListener(SESSIONS_CHANGED_EVENT, refresh);
    window.addEventListener(PLAN_USAGE_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener(SESSIONS_CHANGED_EVENT, refresh);
      window.removeEventListener(PLAN_USAGE_CHANGED_EVENT, refresh);
    };
  }, [load]);

  if (!me || me.is_admin) return null;

  const planId = billing?.plan ?? me.creator?.plan ?? "free";
  const isFree = planId === "free";
  const planLabel = isFree ? "Grátis" : displayPlanName(billing?.plan_label ?? planId);
  const usage = billing?.usage;
  const onPlansPage = pathname.startsWith("/conta/planos");

  const searchesLimit = usage?.searches_limit ?? null;
  const kitsLimit = usage?.kits_limit ?? null;
  const searchesUsed = isFree ? usage?.searches_week ?? 0 : usage?.searches_today ?? 0;
  const kitsUsed = isFree ? usage?.kits_week ?? 0 : usage?.kits_month ?? 0;
  const hasLimitedMeters = Boolean(usage) && (searchesLimit != null || kitsLimit != null);
  const exhausted =
    (searchesLimit != null && searchesUsed >= searchesLimit) ||
    (kitsLimit != null && kitsUsed >= kitsLimit);

  const ctaLabel = onPlansPage
    ? "Gerenciar na conta"
    : isFree
      ? exhausted ? "Desbloquear com o Pro" : "Ver plano Pro"
      : "Ver planos";

  return (
    <section className="tt-rail-plan" aria-label="Seu plano">
      <div className="tt-rail-plan-head">
        <strong>Plano {planLabel}</strong>
        <span className="tt-rail-plan-badge">{planLabel.toUpperCase()}</span>
      </div>

      {hasLimitedMeters ? (
        <div className="tt-rail-plan-usage">
          {searchesLimit != null
            ? <UsageMeter label="Buscas" used={searchesUsed} limit={searchesLimit} period={usage?.searches_limit_period ?? "week"} />
            : <p className="tt-rail-plan-line">Buscas ilimitadas.</p>}
          {kitsLimit != null
            ? <UsageMeter label="Roteiros" used={kitsUsed} limit={kitsLimit} period={usage?.kits_limit_period ?? "month"} />
            : <p className="tt-rail-plan-line">Roteiros ilimitados.</p>}
          {isFree && <p className="tt-rail-plan-note">Buscas e roteiros renovam toda segunda.</p>}
        </div>
      ) : (
        <div className="tt-rail-plan-copy">
          <p>{usage ? "Buscas e roteiros ilimitados." : "Acompanhe suas buscas e roteiros."}</p>
        </div>
      )}

      <Link className="tt-rail-plan-cta" href={onPlansPage ? "/conta" : "/conta/planos"}>
        {ctaLabel}
      </Link>
    </section>
  );
}
