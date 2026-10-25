"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";
import { api } from "@/lib/api";
import { resolveSession } from "@/lib/supabase";
import { FALLBACK_CATALOG } from "@/lib/billing-catalog";
import type { BillingCatalogResponse } from "@/lib/types";

export default function LandingPlans() {
  const [catalog, setCatalog] = useState<BillingCatalogResponse | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    let active = true;
    void api<BillingCatalogResponse>("/billing/plans", undefined)
      .then((data) => { if (active && data?.plans?.length) setCatalog(data); })
      .catch(() => { /* preços de reserva; o checkout é validado na página de planos */ });
    void resolveSession().then((session) => { if (active) setLoggedIn(Boolean(session?.access_token)); }).catch(() => {});
    return () => { active = false; };
  }, []);

  const data = catalog ?? FALLBACK_CATALOG;
  const pro = data.plans.find((plan) => plan.id === "pro");
  const enterprise = data.plans.find((plan) => plan.id === "enterprise");
  const freeSearches = data.free?.searches_total ?? 3;
  const freeKits = data.free?.kits_total ?? 3;
  const launchActive = data.launch?.active === true && Boolean(pro);
  const proPrice = launchActive
    ? pro?.precoLancamentoMensal ?? pro?.precoMensal
    : pro?.precoMensal;

  return (
    <section className="tt-lp-plans" id="planos" aria-labelledby="landing-plans-title">
      <div className="tt-lp-wrap">
        <div className="tt-lp-section-head" data-reveal>
          <div>
            <span className="tt-lp-kicker">Planos</span>
            <h2 id="landing-plans-title">Comece grátis. <em>Cresça no Pro.</em></h2>
          </div>
          <p>
            Faça suas primeiras pesquisas e roteiros sem cartão. Quando precisar de mais volume,
            escolha Pro. Seu trabalho continua salvo.
          </p>
        </div>

        <div className="tt-lp-plan-grid is-duo">
          <article className="tt-lp-price" data-reveal>
            <div className="tt-lp-price-top"><h3>Grátis</h3></div>
            <p className="tt-lp-price-desc">Para descobrir e gravar seus primeiros produtos.</p>
            <div className="tt-lp-price-value"><strong>R$ 0</strong><span>para sempre</span></div>
            <ul className="tt-lp-price-list">
              <li><i aria-hidden="true"><Icon name="check" size={14} /></i> {freeSearches} pesquisas por conta</li>
              <li><i aria-hidden="true"><Icon name="check" size={14} /></i> {freeKits} roteiros por conta</li>
              <li><i aria-hidden="true"><Icon name="check" size={14} /></i> Seus roteiros continuam salvos</li>
            </ul>
            <Link className="tt-lp-btn tt-lp-btn-outline tt-lp-price-cta" href={loggedIn ? "/app" : "/app?mode=signup"}>
              {loggedIn ? "Ir para o app" : "Criar conta grátis"} <Icon name="arrow-right" size={18} />
            </Link>
          </article>
          {pro && (
            <article className="tt-lp-price is-featured" data-reveal>
              <div className="tt-lp-price-top">
                <h3>{pro.nome}</h3>
                <span className="tt-lp-price-badge">{launchActive ? "Lançamento" : "Mais escolhido"}</span>
              </div>
              <p className="tt-lp-price-desc">{pro.resumo}</p>
              <div className="tt-lp-price-value">
                <strong>{proPrice ?? "Sob consulta"}</strong>
                {proPrice && <span>/mês</span>}
              </div>
              {launchActive && pro.precoLancamentoMensal && (
                <p className="tt-lp-price-note">
                  Primeiros 100 clientes: {pro.precoLancamentoMensal}/mês ou {pro.precoLancamentoAnual}/ano enquanto a assinatura estiver ativa.
                </p>
              )}
              <ul className="tt-lp-price-list">
                {pro.bullets.slice(0, 3).map((bullet) => (
                  <li key={bullet}><i aria-hidden="true"><Icon name="check" size={11} /></i> {bullet}</li>
                ))}
              </ul>
              <Link
                className="tt-lp-btn tt-lp-btn-lime tt-lp-price-cta"
                href={`/planos?period=monthly#plan-${pro.id}`}
              >
                Ver plano {pro.nome}
                <Icon name="arrow-right" size={18} />
              </Link>
            </article>
          )}

        </div>

        <p className="tt-lp-plans-note">
          Os limites do Grátis são totais por conta, sem renovação mensal.
          {enterprise && <Link href="/app/suporte">Precisa de mais? Fale sobre Enterprise <Icon name="arrow-right" size={14} /></Link>}
          <Link href="/planos">Comparar os planos <Icon name="arrow-right" size={14} /></Link>
        </p>
      </div>
    </section>
  );
}
