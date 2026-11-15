"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";
import { api } from "@/lib/api";
import { resolveSession } from "@/lib/supabase";
import { FALLBACK_CATALOG, PLAN_OUTCOME } from "@/lib/billing-catalog";
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
        </div>

        <div className="tt-lp-plan-grid is-duo">
          <article className="tt-lp-price is-free" data-reveal>
            <div className="tt-lp-price-top">
              <h3>Grátis</h3>
              <span className="tt-lp-price-badge is-free">Para começar</span>
            </div>
            <p className="tt-lp-price-desc">Explore a plataforma no seu ritmo.</p>
            <div className="tt-lp-price-value"><strong>R$ 0</strong><span>/para começar</span></div>
            <div className="tt-lp-price-outcome">
              <span>Incluído por conta</span>
              <p>Pesquise, escolha um produto e crie seus primeiros vídeos.</p>
            </div>
            <ul className="tt-lp-price-list">
              <li><i aria-hidden="true"><Icon name="check" size={14} /></i> Acesso ao fluxo completo do Grátis</li>
              <li><i aria-hidden="true"><Icon name="check" size={14} /></i> Conteúdo salvo na conta</li>
              <li><i aria-hidden="true"><Icon name="check" size={14} /></i> Sem renovação automática</li>
            </ul>
            <Link className="tt-lp-btn tt-lp-btn-outline tt-lp-price-cta" href={loggedIn ? "/descobrir" : "/descobrir?mode=signup"}>
              {loggedIn ? "Ir para o app" : "Criar conta grátis"} <Icon name="arrow-right" size={18} />
            </Link>
            <p className="tt-lp-price-fineprint">Os limites e recursos do Grátis podem ser ajustados.</p>
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
              <div className="tt-lp-price-outcome">
                <span>Na prática</span>
                <p>{PLAN_OUTCOME[pro.id] || pro.resumo}</p>
              </div>
              <ul className="tt-lp-price-list">
                {pro.bullets.map((bullet) => (
                  <li key={bullet}><i aria-hidden="true"><Icon name="check" size={11} /></i> {bullet}</li>
                ))}
              </ul>
              <Link
                className="tt-lp-btn tt-lp-btn-lime tt-lp-price-cta"
                href="/planos"
              >
                Assinar Pro
                <Icon name="arrow-right" size={18} />
              </Link>
              <p className="tt-lp-price-fineprint">Uso justo conforme os Termos. O valor cobrado é o exibido no checkout.</p>
            </article>
          )}

        </div>

        <p className="tt-lp-plans-note">
          Comece grátis. Seu trabalho fica salvo.
        </p>
      </div>
    </section>
  );
}
