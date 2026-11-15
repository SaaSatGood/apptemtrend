"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";
import { api, friendlyError } from "@/lib/api";
import { track } from "@/lib/track";
import { displayPlanName } from "@/lib/plan-display";
import { FALLBACK_CATALOG, planBullets } from "@/lib/billing-catalog";
import type { BillingCatalogResponse, BillingSubscriptionSummary } from "@/lib/types";
import { usePlatform } from "./store";

type Period = "monthly" | "annual";
type PaymentMethod = "card" | "pix";

const STATUS_LABEL: Record<string, string> = {
  active: "Ativo",
  trialing: "Grátis",
  canceled: "Cancelado",
  past_due: "Pagamento pendente",
  inactive: "",
};

function fmtDate(iso?: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function monthlyEquivalent(cents: number | null): string | null {
  if (!cents) return null;
  return (cents / 12 / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Planos e acesso dentro do dashboard: leitura simples, dois planos e uma ação por card. */
export default function PlansView({ initialPeriod = "annual" }: { initialPeriod?: Period }) {
  const { session, me } = usePlatform();
  const token = session?.access_token;
  const [catalog, setCatalog] = useState<BillingCatalogResponse | null>(null);
  const [sub, setSub] = useState<BillingSubscriptionSummary | null>(null);
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [busy, setBusy] = useState<PaymentMethod | null>(null);
  const [notice, setNotice] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    track("pricing_view", { logged: true });
  }, []);

  useEffect(() => {
    if (!token) return;
    let active = true;
    void (async () => {
      try {
        const data = await api<BillingCatalogResponse>("/billing/plans", undefined);
        if (active && data?.plans?.length) setCatalog(data);
      } catch {
        /* catálogo local de reserva */
      }
      try {
        const summary = await api<BillingSubscriptionSummary>("/billing/subscription", token);
        if (!active || !summary?.enabled) return;
        setSub(summary);
        if (summary.has_active_subscription && (summary.period === "monthly" || summary.period === "annual")) {
          setPeriod(summary.period);
        }
      } catch {
        /* o resumo cai no estado do perfil */
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  const data = catalog ?? FALLBACK_CATALOG;
  const checkoutEnabled = catalog?.enabled === true;
  const pro = data.plans.find((plan) => plan.id === "pro");
  const launchActive = data.launch?.active === true && Boolean(pro);
  const hasActiveSub = sub?.has_active_subscription === true;
  const paidPlanId = sub?.plan ?? me?.creator?.plan ?? "free";
  const isFree = !paidPlanId || paidPlanId === "free";
  const planId = paidPlanId && paidPlanId !== "free" ? paidPlanId : null;
  const currentPlanName = isFree ? "Grátis" : displayPlanName(sub?.plan_label ?? planId);
  const periodEnd = sub?.current_period_end ?? me?.creator?.current_period_end ?? null;

  const amount = pro
    ? period === "annual"
      ? launchActive ? pro.precoLancamentoAnual : pro.precoAnual
      : launchActive ? pro.precoLancamentoMensal : pro.precoMensal
    : null;
  const listAmount = pro ? (period === "annual" ? pro.precoAnual : pro.precoMensal) : null;
  const amountCents = pro
    ? period === "annual"
      ? launchActive ? pro.precoLancamentoAnualCents ?? null : pro.precoAnualCents
      : launchActive ? pro.precoLancamentoMensalCents ?? null : pro.precoMensalCents
    : null;
  const equivalent = period === "annual" ? monthlyEquivalent(amountCents) : null;

  const bullets = pro ? planBullets(pro) : [];
  const coreFeatures = bullets.filter((bullet) => /kit|busca|roteiro|varia/i.test(bullet));
  const extraFeatures = bullets.filter((bullet) => !/kit|busca|roteiro|varia/i.test(bullet));

  const accessText = (() => {
    if (isFree) return "Plano Grátis ativo";
    if (!periodEnd) return "Acesso completo";
    if (sub?.renewal_due) return `Período termina em ${fmtDate(periodEnd)}`;
    if (sub?.status === "canceled" || sub?.cancel_at_period_end) return `Acesso até ${fmtDate(periodEnd)}`;
    return `${STATUS_LABEL[sub?.status ?? ""] || "Ativo"} · renova em ${fmtDate(periodEnd)}`;
  })();

  async function subscribe(method: PaymentMethod) {
    if (!token) return;
    track("upgrade_click", { plan: "pro", period, method });
    track("checkout_started", { plan: "pro", period, method });
    setBusy(method);
    setErrorMsg("");
    setNotice("");
    try {
      const result = await api<{ url: string }>("/billing/checkout", token, {
        method: "POST",
        body: JSON.stringify({ plan: "pro", period, method }),
      });
      window.location.assign(result.url);
    } catch (err) {
      setErrorMsg(friendlyError(err, "Não conseguimos iniciar o pagamento agora. Tente novamente."));
      setBusy(null);
    }
  }

  let proCta: { label: string; disabled: boolean; onClick?: () => void };
  if (hasActiveSub) {
    proCta = sub?.renewal_due
      ? { label: busy === "pix" ? "Abrindo PIX…" : "Renovar com PIX", disabled: busy !== null, onClick: () => void subscribe("pix") }
      : { label: "Seu plano atual", disabled: true };
  } else if (!checkoutEnabled) {
    proCta = { label: "Assinaturas em breve", disabled: true };
  } else {
    proCta = { label: busy === "pix" ? "Abrindo PIX…" : "Assinar com PIX", disabled: busy !== null, onClick: () => void subscribe("pix") };
  }

  const proTag = hasActiveSub
    ? sub?.renewal_due ? "Renovação pendente" : "Plano atual"
    : launchActive ? "Preço de lançamento" : "Mais popular";

  return (
    <section className="plans-view" aria-labelledby="plans-title">
        <header className="plans-head">
          <div className="plans-head-copy">
            <h1 id="plans-title">Planos e acesso</h1>
            <p className="plans-sub">
              Explore gratuitamente. Libere todas as categorias e crie sem contar roteiros com o Pro.
            </p>
          </div>
          <aside className="plans-access" aria-label="Seu acesso atual">
            <span className={`plans-access-dot${isFree ? "" : " is-active"}`} aria-hidden="true" />
            <div className="plans-access-copy">
              <small>Seu acesso</small>
              <strong>Plano {currentPlanName}</strong>
              <span>{accessText}</span>
            </div>
          </aside>
        </header>

        <div className="plans-toggle">
          <div className="plans-toggle-inner" role="group" aria-label="Período de cobrança">
            <button
              type="button"
              aria-pressed={period === "monthly"}
              className={period === "monthly" ? "is-active" : ""}
              disabled={hasActiveSub}
              onClick={() => setPeriod("monthly")}
            >
              Mensal
            </button>
            <button
              type="button"
              aria-pressed={period === "annual"}
              className={period === "annual" ? "is-active" : ""}
              disabled={hasActiveSub}
              onClick={() => setPeriod("annual")}
            >
              Anual
              {pro && pro.precoMensalCents != null && pro.precoAnualCents === pro.precoMensalCents * 10 && (
                <span className="plans-toggle-badge">2 meses grátis</span>
              )}
            </button>
          </div>
          {hasActiveSub && <p className="plans-toggle-note">Trocas de plano mantêm seu ciclo de cobrança atual.</p>}
        </div>

        {(notice || errorMsg) && (
          <p className={`plans-feedback${errorMsg ? " is-error" : ""}`} role={errorMsg ? "alert" : "status"}>
            {errorMsg || notice}
          </p>
        )}

        <div className="plans-grid">
          <article className="plans-card">
            <span className="plans-card-tag">Para começar</span>
            <div className="plans-card-copy">
              <h2>Grátis</h2>
              <p>Para começar a explorar.</p>
            </div>
            <div className="plans-price">
              <strong>R$ 0</strong>
              <span>/para começar</span>
            </div>
            <p className="plans-price-note">
              Acesso ao fluxo completo da plataforma.
            </p>
            {isFree ? (
              <button className="plans-cta" type="button" disabled>Seu plano atual</button>
            ) : (
              <Link className="plans-cta" href="/descobrir">Ir para o app</Link>
            )}
            <div className="plans-features">
              <h3>Incluído</h3>
              <ul>
                <li><Icon name="check" size={14} /><span>Conteúdo salvo na conta</span></li>
                <li><Icon name="check" size={14} /><span>Sem renovação automática</span></li>
              </ul>
              <p className="plans-feature-note">O catálogo completo de produtos fica no Pro.</p>
            </div>
          </article>

          {pro && (
            <article className="plans-card is-featured">
              <span className="plans-card-tag">{proTag}</span>
              <div className="plans-card-copy">
                <h2>{pro.nome}</h2>
                <p>{pro.resumo}</p>
              </div>
              <div className="plans-price">
                <strong>{amount ?? "Sob consulta"}</strong>
                {amount && <span>{period === "annual" ? "/ano" : "/mês"}</span>}
              </div>
              <p className="plans-price-note">
                {launchActive && listAmount ? <><s>{listAmount}{period === "annual" ? "/ano" : "/mês"}</s> · </> : null}
                {equivalent
                  ? `${equivalent}/mês, cobrado uma vez por ano.`
                  : "Cobrança mensal. Cancele quando quiser."}
              </p>
              <div className="plans-card-actions">
                <button
                  type="button"
                  className="plans-cta"
                  disabled={proCta.disabled}
                  onClick={proCta.onClick}
                >
                  {proCta.label}
                  {!proCta.disabled && busy !== "pix" && <Icon name="pix" size={15} />}
                </button>
                {!proCta.disabled && (
                  <button
                    type="button"
                    className="plans-cta is-secondary"
                    disabled={busy !== null}
                    onClick={() => void subscribe("card")}
                  >
                    {busy === "card"
                      ? "Abrindo cartão…"
                      : hasActiveSub ? "Renovar com cartão" : "Pagar com cartão"}
                    {busy !== "card" && <Icon name="plan" size={15} />}
                  </button>
                )}
              </div>
              <div className="plans-features">
                {coreFeatures.length > 0 && (
                  <div className="plans-feature-group">
                    <h3>Criação</h3>
                    <ul>
                      {coreFeatures.map((bullet) => (
                        <li key={bullet}><Icon name="check" size={14} /><span>{bullet}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
                {extraFeatures.length > 0 && (
                  <div className="plans-feature-group">
                    <h3>Extras</h3>
                    <ul>
                      {extraFeatures.map((bullet) => (
                        <li key={bullet}><Icon name="check" size={14} /><span>{bullet}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </article>
          )}
        </div>

        <footer className="plans-foot">
          <span><Icon name="check" size={13} />Pagamento seguro</span>
          <span><Icon name="check" size={13} />Cancele quando quiser</span>
          <span><Icon name="check" size={13} />7 dias de arrependimento (CDC)</span>
          <span>Precisa de algo sob medida? <Link href="/suporte">Fale com o suporte</Link></span>
        </footer>
    </section>
  );
}
