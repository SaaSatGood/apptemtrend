"use client";

import Link from "next/link";
import { usePlatform } from "./store";

function daysLeft(iso?: string | null): number | null {
  if (!iso) return null;
  const end = Date.parse(iso);
  if (!Number.isFinite(end)) return null;
  return Math.max(0, Math.ceil((end - Date.now()) / 86_400_000));
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Faixa contextual de plano: trial, trial encerrado (sem plano) ou pagamento pendente. */
export default function PlanBanner() {
  const { me } = usePlatform();
  const creator = me?.creator;
  if (!creator) return null;

  if (creator.plan_status === "trialing") {
    const days = daysLeft(creator.trial_ends_at);
    if (days === null) return null;
    if (days <= 0) {
      return (
        <div className="plan-banner" role="status">
          <span>Seu período de teste terminou — assine para voltar a criar. Tudo o que você fez continua salvo.</span>
          <Link href="/planos">Ver planos</Link>
        </div>
      );
    }
    return (
      <div className="plan-banner" role="status">
        <span>
          Trial Pro · {days} {days === 1 ? "dia restante" : "dias restantes"} com tudo liberado, sem cartão
        </span>
        <Link href="/planos">Ver planos</Link>
      </div>
    );
  }

  if (creator.plan_status === "past_due") {
    return (
      <div className="plan-banner is-warn" role="alert">
        <span>Pagamento pendente — seu acesso segue liberado enquanto o provedor tenta de novo.</span>
        <Link href="/app/conta">Ver na conta</Link>
      </div>
    );
  }

  if (creator.plan_status === "canceled" && creator.current_period_end) {
    return (
      <div className="plan-banner" role="status">
        <span>Assinatura cancelada — acesso liberado até {fmtDate(creator.current_period_end)}.</span>
        <Link href="/planos">Reativar</Link>
      </div>
    );
  }

  return null;
}
