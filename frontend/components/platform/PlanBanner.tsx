"use client";

import Link from "next/link";
import { usePlatform } from "./store";

function fmtDate(iso?: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Faixa contextual para pagamento pendente ou assinatura cancelada. */
export default function PlanBanner() {
  const { me } = usePlatform();
  const creator = me?.creator;
  if (!creator) return null;

  if (creator.plan_status === "past_due") {
    return (
      <div className="plan-banner is-warn" role="alert">
        <span>Pagamento pendente — seu acesso segue liberado enquanto o provedor tenta de novo.</span>
        <Link href="/conta">Ver na conta</Link>
      </div>
    );
  }

  if (creator.plan_status === "canceled" && creator.current_period_end) {
    return (
      <div className="plan-banner" role="status">
        <span>Assinatura cancelada — acesso liberado até {fmtDate(creator.current_period_end)}.</span>
        <Link href="/conta/planos">Reativar</Link>
      </div>
    );
  }

  return null;
}
