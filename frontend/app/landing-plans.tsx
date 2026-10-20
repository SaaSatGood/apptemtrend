"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { FALLBACK_CATALOG } from "@/lib/billing-catalog";
import type { BillingCatalogResponse } from "@/lib/types";

export default function LandingPlans() {
  const [catalog, setCatalog] = useState<BillingCatalogResponse | null>(null);

  useEffect(() => {
    let active = true;
    void api<BillingCatalogResponse>("/billing/plans", undefined)
      .then((data) => { if (active && data?.plans?.length) setCatalog(data); })
      .catch(() => { /* preços de reserva; o checkout é validado na página de planos */ });
    return () => { active = false; };
  }, []);

  const data = catalog ?? FALLBACK_CATALOG;
  const plans = data.plans.filter((plan) => ["essencial", "pro", "scale"].includes(plan.id));

  return (
    <section className="tt-landing-plans" id="planos" aria-labelledby="landing-plans-title">
      <div className="tt-rd-shell">
        <div className="tt-landing-plans-head">
          <div>
            <span className="tt-rd-kicker">Planos TemTrend</span>
            <h2 id="landing-plans-title">Um plano para cada <em>ritmo de criação.</em></h2>
          </div>
          <p>Comece com {data.trial_days} dias de Pro, sem cartão. Depois, escolha o volume de criação que faz sentido para você.</p>
        </div>
        <div className="tt-landing-plans-grid">
          {plans.map((plan) => (
            <article className={`tt-landing-plan${plan.destaque ? " is-featured" : ""}`} key={plan.id}>
              <div className="tt-landing-plan-top">
                <span>{plan.destaque ? "Mais escolhido" : "Plano"}</span>
                <h3>{plan.nome}</h3>
                <p>{plan.resumo}</p>
              </div>
              <div className="tt-landing-plan-price">
                <strong>{plan.precoMensal ?? "Sob consulta"}</strong>
                {plan.precoMensal && <span>/mês</span>}
              </div>
              <ul>
                {plan.bullets.slice(0, 3).map((bullet) => <li key={bullet}>{bullet}</li>)}
              </ul>
              <Link href={`/planos?period=monthly#plan-${plan.id}`} className="tt-landing-plan-link" aria-label={`Ver o plano ${plan.nome} e escolher a assinatura mensal`}>
                Ver plano {plan.nome} <span aria-hidden="true">→</span>
              </Link>
            </article>
          ))}
        </div>
        <div className="tt-landing-plans-foot">
          <p>Valores do plano mensal. Há opção anual na página de planos.</p>
          <Link href="/planos">Comparar todos os recursos <span aria-hidden="true">→</span></Link>
        </div>
      </div>
    </section>
  );
}
