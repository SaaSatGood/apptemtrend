"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/ui/Icon";
import { resolveSession } from "@/lib/supabase";
import { api, friendlyError } from "@/lib/api";
import { track } from "@/lib/track";
import type { BillingCatalogResponse, BillingPlanMeta, BillingSubscriptionSummary } from "@/lib/types";
import PublicFooter from "@/components/PublicFooter";
import PublicNav from "@/components/PublicNav";
import { displayPlanName } from "@/lib/plan-display";
import { FALLBACK_CATALOG, PLAN_OUTCOME, planBullets } from "@/lib/billing-catalog";

type Period = "monthly" | "annual";
type PaidPlan = "pro";
type AuthState = "checking" | "guest" | "authenticated";
type AccountPlan = { nome?: string; status?: string; trial_ends_at?: string | null; current_period_end?: string | null };

const FAQS = [
  {
    q: "Posso cancelar quando quiser?",
    a: "Sim, em um clique na sua conta — sem multa e sem ligação. Você continua com acesso até o fim do período já pago e nada é apagado.",
  },
  {
    q: "Como funciona o pagamento?",
    a: "PIX ou cartão, conforme a disponibilidade no checkout. No cartão, a renovação é automática; no PIX, o período é pré-pago e você renova pela sua conta. No plano anual, você paga 10 meses e leva 12.",
  },
  {
    q: "Como funciona o preço de lançamento?",
    a: "Os primeiros 100 clientes mantêm R$ 39,90/mês ou R$ 399/ano enquanto a assinatura estiver ativa. A condição é aplicada automaticamente no checkout, enquanto houver vaga. Se você cancelar, o acesso continua até o fim do período pago.",
  },
  {
    q: "Meus roteiros ficam salvos se eu cancelar?",
    a: "Ficam. Seu histórico continua visível e nada é apagado. Sem assinatura, você pode usar os créditos restantes do Grátis; depois, basta assinar para continuar criando.",
  },
  {
    q: "Como funciona o plano Grátis?",
    a: "Cada conta pode fazer 3 pesquisas e criar 3 roteiros no total, sem prazo e sem cartão. Depois disso, seus conteúdos continuam salvos e você pode assinar o Pro se quiser continuar criando.",
  },
  {
    q: "E se eu me arrepender depois de assinar?",
    a: "A primeira compra tem 7 dias de direito de arrependimento (art. 49 do CDC): você desiste pelo Suporte, sem justificar, e recebe 100% de volta — mensal ou anual. Depois disso, é só cancelar quando quiser, sem multa: você mantém o acesso até o fim do período pago.",
  },
  {
    q: "O que não está incluído?",
    a: "A TemTrend não grava nem publica por você e não promete vendas. Ela entrega o plano de gravação completo e organiza sua produção do roteiro ao publicado.",
  },
];

function monthlyEquivalent(cents: number | null): string | null {
  if (!cents) return null;
  return (cents / 12 / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const STATUS_LABEL: Record<string, string> = {
  active: "Ativo",
  trialing: "Grátis",
  canceled: "Cancelado",
  past_due: "Pagamento pendente",
  inactive: "",
};

export default function PricingPage({ initialPeriod = "annual" }: { initialPeriod?: Period }) {
  const router = useRouter();
  const [catalog, setCatalog] = useState<BillingCatalogResponse | null>(null);
  const [sub, setSub] = useState<BillingSubscriptionSummary | null>(null);
  const [accountPlan, setAccountPlan] = useState<AccountPlan | null>(null);
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [busy, setBusy] = useState<PaidPlan | null>(null);
  const [notice, setNotice] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    track("pricing_view", { logged: false });
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const data = await api<BillingCatalogResponse>("/billing/plans", undefined);
        if (active && data?.plans?.length) setCatalog(data);
      } catch {
        /* catálogo local de reserva */
      }
      try {
        const session = await resolveSession();
        const token = session?.access_token;
        if (!token) {
          if (active) setAuthState("guest");
          return;
        }
        if (active) setAuthState("authenticated");
        try {
          const account = await api<{ plan?: AccountPlan }>("/account", token);
          if (active) setAccountPlan(account.plan ?? null);
        } catch { /* o resumo de cobrança ainda pode carregar */ }
        const summary = await api<BillingSubscriptionSummary>("/billing/subscription", token);
        if (active && summary?.enabled) {
          setSub(summary);
          if (summary.has_active_subscription && (summary.period === "monthly" || summary.period === "annual")) {
            setPeriod(summary.period);
          }
        }
      } catch {
        // A sessão e o resumo são estados independentes: uma falha da API de
        // billing nunca deve mandar um usuário autenticado de volta ao cadastro.
        if (active) setAuthState((current) => current === "checking" ? "guest" : current);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const data = catalog ?? FALLBACK_CATALOG;
  const checkoutEnabled = catalog?.enabled === true;
  const loggedIn = authState === "authenticated";
  const pro = data.plans.find((p) => p.id === "pro");
  const enterprise = data.plans.find((p) => p.id === "enterprise");
  const launchActive = data.launch?.active === true && Boolean(pro);
  const hasActiveSub = sub?.has_active_subscription === true;
  const paidPlan = sub && sub.plan && sub.plan !== "free" ? sub.plan : null;
  const currentPlanName = displayPlanName(accountPlan?.nome || sub?.plan_label);

  async function token(): Promise<string | undefined> {
    try {
      const session = await resolveSession();
      return session?.access_token;
    } catch {
      return undefined;
    }
  }

  function goToSignup(plan: PaidPlan) {
    track("upgrade_click", { plan, period });
    try {
      localStorage.setItem("temtrend_intended_plan", plan);
    } catch {
      /* armazenamento opcional */
    }
    const next = `/planos?plan=${plan}&period=${period}`;
    router.push(`/app?mode=signup&next=${encodeURIComponent(next)}`);
  }

  async function subscribe(plan: PaidPlan) {
    if (!loggedIn) {
      goToSignup(plan);
      return;
    }
    track("upgrade_click", { plan, period });
    setBusy(plan);
    setErrorMsg("");
    setNotice("");
    try {
      const accessToken = await token();
      const result = await api<{ url: string; mode?: string; launch?: boolean }>("/billing/checkout", accessToken, {
        method: "POST",
        body: JSON.stringify({ plan, period }),
      });
      window.location.assign(result.url);
    } catch (err) {
      setErrorMsg(friendlyError(err, "Não conseguimos iniciar o pagamento agora. Tente novamente."));
      setBusy(null);
    }
  }

  async function changePlan(plan: PaidPlan) {
    track("upgrade_click", { plan, period, change: true });
    setBusy(plan);
    setErrorMsg("");
    setNotice("");
    try {
      const accessToken = await token();
      const result = await api<{ scheduled: boolean; effective_at: string | null }>("/billing/change-plan", accessToken, {
        method: "POST",
        body: JSON.stringify({ plan, period }),
      });
      const label = data.plans.find((p) => p.id === plan)?.nome ?? plan;
      setNotice(
        result?.effective_at
          ? `Mudança para o ${label} agendada — a nova cobrança vale a partir de ${fmtDate(result.effective_at)}. Você mantém tudo o que já criou.`
          : `Mudança para o ${label} agendada para o próximo ciclo.`,
      );
      const summary = await api<BillingSubscriptionSummary>("/billing/subscription", accessToken);
      if (summary?.enabled) setSub(summary);
    } catch (err) {
      setErrorMsg(friendlyError(err, "Não conseguimos agendar a mudança agora. Tente novamente."));
    } finally {
      setBusy(null);
    }
  }

  function planCta(p: BillingPlanMeta) {
    if (authState === "checking") {
      return { label: "Verificando sua conta…", disabled: true, onClick: undefined as (() => void) | undefined };
    }
    const current = hasActiveSub && paidPlan === p.id && sub?.period === period;
    if (current) {
      if (sub?.renewal_due) {
        return {
          label: busy === p.id ? "Abrindo pagamento…" : "Renovar acesso",
          disabled: busy !== null,
          onClick: () => void subscribe(p.id as PaidPlan),
        };
      }
      return { label: "Seu plano atual", disabled: true, onClick: undefined as (() => void) | undefined };
    }
    if (hasActiveSub) {
      return {
        label: busy === p.id ? "Agendando…" : `Mudar para ${p.nome}`,
        disabled: busy !== null,
        onClick: () => void changePlan(p.id as PaidPlan),
      };
    }
    if (!checkoutEnabled) {
      return loggedIn
        ? { label: "Assinaturas em breve", disabled: true, onClick: undefined }
        : { label: "Criar conta grátis", disabled: false, onClick: () => router.push("/app?mode=signup") };
    }
    return {
      label: busy === p.id ? "Abrindo pagamento…" : "Assinar Pro",
      disabled: busy !== null,
      onClick: () => void subscribe(p.id as PaidPlan),
    };
  }

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
  const launchMonthly = pro?.precoLancamentoMensal ?? "R$ 39,90";
  const launchAnnual = pro?.precoLancamentoAnual ?? "R$ 399,00";
  const standardMonthly = pro?.precoMensal ?? "R$ 49,90";
  const standardAnnual = pro?.precoAnual ?? "R$ 499,00";
  const compareMonthly = launchActive ? launchMonthly : standardMonthly;
  const compareAnnual = launchActive ? launchAnnual : standardAnnual;

  return (
    <div className="tt-pricing">
      <PublicNav page="pricing" />

      <main>
        <section className="tt-pricing-hero">
          <p className="tt-pricing-kicker"><span aria-hidden="true" /> Planos</p>
          <h1>Comece grátis. Crie sem limites no Pro.</h1>
          <p className="tt-pricing-sub">
            Encontre o produto e receba um plano de gravação em 8 partes, do roteiro à publicação.
          </p>
          <p className="tt-pricing-trial-chip">3 pesquisas e 3 roteiros grátis por conta · sem cartão</p>
          {!checkoutEnabled && <p className="tt-pricing-availability">O Grátis já está disponível. As assinaturas Pro ainda não estão abertas.</p>}
        </section>

        {loggedIn && (
          <section className="tt-pricing-current" aria-label="Seu plano atual">
            <div>
              <strong>
                Seu plano: {currentPlanName}
              </strong>
              <span>
                {sub?.current_period_end && sub?.plan !== "free"
                    ? `${STATUS_LABEL[sub?.status ?? ""] || "Ativo"} · ${sub?.status === "canceled" ? "acesso até" : "renova em"} ${fmtDate(sub.current_period_end)}`
                    : "3 pesquisas e 3 roteiros por conta, sem prazo"}
                {sub?.launch_price ? " · preço de lançamento" : ""}
                {sub?.payment_mode === "one_time" ? " · pagamento por período" : ""}
              </span>
              {sub?.pending_plan_label && (
                <span className="tt-pricing-current-pending">
                  Mudança para {sub.pending_plan_label} agendada para o próximo ciclo
                </span>
              )}
              {sub?.renewal_due && (
                <span className="tt-pricing-current-pending">
                  Seu período termina em {fmtDate(sub.current_period_end)}. Renove para não perder o acesso.
                </span>
              )}
            </div>
            <Link className="tt-pricing-manage" href="/app/conta">Gerenciar na conta</Link>
          </section>
        )}

        {launchActive && data.launch && (
          <section className="tt-launch-band" aria-label="Condição de lançamento">
            <span className="tt-launch-kicker">Lançamento · primeiros 100 clientes</span>
            <strong>{launchMonthly}/mês ou {launchAnnual}/ano enquanto a assinatura estiver ativa.</strong>
            <p>
              Restam {data.launch.seats_left} de {data.launch.seats_total} vagas. A condição é aplicada automaticamente no checkout.
            </p>
          </section>
        )}

        <div className="tt-pricing-toggle" role="group" aria-label="Período de cobrança">
          <div className="tt-pricing-toggle-inner">
            <button
              type="button"
              aria-pressed={period === "monthly"}
              className={period === "monthly" ? "active" : ""}
              onClick={() => setPeriod("monthly")}
              disabled={hasActiveSub}
            >
              Mensal
            </button>
            <button
              type="button"
              aria-pressed={period === "annual"}
              className={period === "annual" ? "active" : ""}
              onClick={() => setPeriod("annual")}
              disabled={hasActiveSub}
            >
              Anual
              {pro && pro.precoMensalCents != null && pro.precoAnualCents === pro.precoMensalCents * 10 && <span className="tt-pricing-badge">2 meses grátis</span>}
            </button>
          </div>
          {hasActiveSub && (
            <p className="tt-pricing-period-note">Trocas de plano mantêm seu ciclo de cobrança atual.</p>
          )}
        </div>

        {(notice || errorMsg) && (
          <p className={`tt-pricing-feedback${errorMsg ? " is-error" : ""}`} role={errorMsg ? "alert" : "status"}>
            {errorMsg || notice}
          </p>
        )}

        <section className="tt-pricing-grid is-duo" aria-label="Planos e preços">
          <article id="plan-free" className="tt-price-card">
            <span className="tt-price-seal">Para começar</span>
            <header><h2>Grátis</h2><p>Explore a plataforma no seu ritmo.</p></header>
            <div className="tt-price-amount">R$ 0<small>/para sempre</small></div>
            <div className="tt-price-outcome"><span>Incluído por conta</span><p>Pesquise, escolha um produto e crie seus primeiros vídeos.</p></div>
            <ul className="tt-price-bullets">
              <li><Icon name="check" size={14} /><span>3 pesquisas no total</span></li>
              <li><Icon name="check" size={14} /><span>3 roteiros no total</span></li>
              <li><Icon name="check" size={14} /><span>Conteúdo salvo na conta</span></li>
              <li><Icon name="check" size={14} /><span>Sem cartão e sem prazo de teste</span></li>
            </ul>
            <Link className="tt-price-cta is-ghost" href={loggedIn ? "/app" : "/app?mode=signup"}>{loggedIn ? "Ir para o app" : "Criar conta grátis"}</Link>
            <p className="tt-price-fineprint">Os limites não se renovam a cada mês.</p>
          </article>
          {pro && (() => {
            const cta = planCta(pro);
            const bullets = planBullets(pro);
            return (
              <article id={`plan-${pro.id}`} className="tt-price-card is-featured">
                <span className="tt-price-seal">{launchActive ? "Preço de lançamento" : "Plano único"}</span>
                <header>
                  <h2>{pro.nome}</h2>
                  <p>{pro.resumo}</p>
                </header>
                <div className="tt-price-amount">
                  {amount ?? "Sob consulta"}
                  {amount && <small>{period === "annual" ? "/ano" : "/mês"}</small>}
                </div>
                {launchActive && listAmount && (
                  <p className="tt-price-launch-note">
                    <s>{listAmount}{period === "annual" ? "/ano" : "/mês"}</s> · condição dos primeiros 100 clientes
                  </p>
                )}
                {equivalent && (
                  <p className="tt-price-equivalent">
                    Mensal: {compareMonthly}/mês · Anual: {equivalent}/mês, cobrado uma vez por ano
                  </p>
                )}
                <div className="tt-price-outcome">
                  <span>Na prática</span>
                  <p>{PLAN_OUTCOME[pro.id] || pro.resumo}</p>
                </div>
                <ul className="tt-price-bullets">
                  {bullets.map((bullet) => (
                    <li key={bullet}><Icon name="check" size={14} /><span>{bullet}</span></li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="tt-price-cta"
                  disabled={cta.disabled}
                  onClick={cta.onClick}
                >
                  {cta.label}
                </button>
                <p className="tt-price-fineprint">
                  Uso justo conforme os Termos. O preço de lançamento vale enquanto a assinatura estiver ativa.
                </p>
              </article>
            );
          })()}

        </section>

        {enterprise && <p className="tt-pricing-enterprise-note">Precisa de uma operação sob medida? <Link href="/app/suporte">Converse com o suporte interno</Link>.</p>}

        <section className="tt-compare">
          <details open>
            <summary>Comparar todos os recursos <span className="tt-details-toggle" aria-hidden="true"><Icon name="plus" size={18} className="tt-details-open" /><Icon name="minus" size={18} className="tt-details-close" /></span></summary>
            <div className="tt-compare-scroll">
              <table>
                <caption className="sr-only">Comparação de recursos por plano</caption>
                <thead>
                  <tr>
                    <th scope="col">Recurso</th>
                    <th scope="col">Grátis</th>
                    <th scope="col">Pro</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><th scope="row">Roteiros</th><td>3 no total</td><td>Ilimitados (uso justo)</td></tr>
                  <tr><th scope="row">Pesquisas</th><td>3 no total</td><td>Ilimitadas (uso justo)</td></tr>
                  <tr><th scope="row">Gerar outra versão</th><td>Não incluído</td><td>A cada 30s</td></tr>
                  <tr><th scope="row">Voz personalizada</th><td>Não incluído</td><td>Incluído</td></tr>
                  <tr><th scope="row">Itens na produção</th><td>3</td><td>Ilimitados</td></tr>
                  <tr><th scope="row">Suporte</th><td>Interno</td><td>Interno</td></tr>
                  <tr><th scope="row">Preço</th><td>R$ 0</td><td>{compareMonthly}/mês ou {compareAnnual}/ano</td></tr>
                </tbody>
              </table>
            </div>
          </details>
        </section>

        <section className="tt-faq-pricing" aria-label="Perguntas frequentes">
          <h2>Perguntas frequentes</h2>
          <div className="tt-faq-pricing-list">
            {FAQS.map((item) => (
              <details key={item.q}>
                <summary>{item.q} <span className="tt-details-toggle" aria-hidden="true"><Icon name="plus" size={18} className="tt-details-open" /><Icon name="minus" size={18} className="tt-details-close" /></span></summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="tt-pricing-trust" aria-label="Garantias">
          <span><Icon name="check" size={14} />Grátis sem cartão</span>
          <span><Icon name="check" size={14} />Cancele quando quiser</span>
          <span><Icon name="check" size={14} />7 dias de arrependimento (CDC)</span>
          <span><Icon name="check" size={14} />Seus kits continuam seus</span>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
