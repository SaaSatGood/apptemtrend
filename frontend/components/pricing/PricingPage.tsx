"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { resolveSession } from "@/lib/supabase";
import { api, friendlyError } from "@/lib/api";
import { track } from "@/lib/track";
import type { BillingCatalogResponse, BillingSubscriptionSummary } from "@/lib/types";
import PublicNav from "@/components/PublicNav";
import { displayPlanName } from "@/lib/plan-display";

type Period = "monthly" | "annual";
type PaidPlan = "essencial" | "pro" | "scale";
type AuthState = "checking" | "guest" | "authenticated";
type AccountPlan = { nome?: string; status?: string; trial_ends_at?: string | null; current_period_end?: string | null };

// Espelho do catálogo do backend (mesmo relatório de preços). Usado apenas se
// a API não responder — os CTAs degradam para cadastro, nunca para cobrança errada.
const FALLBACK: BillingCatalogResponse = {
  enabled: false,
  trial_days: 7,
  plans: [
    {
      id: "essencial", nome: "Essencial", resumo: "Para o creator iniciante",
      precoMensalCents: 2990, precoAnualCents: 29900, precoMensal: "R$ 29,90", precoAnual: "R$ 299,00",
      bullets: ["30 kits de conteúdo por mês", "50 buscas de IA por dia", "Variações do roteiro (a cada 60s)", "Voz personalizada no roteiro", "5 roteiros salvos por produto", "50 itens na produção"],
      destaque: false,
      limits: { searchesPerDay: 50, kitsPerMonth: 30, variations: true, variationCooldownSeconds: 60, vozPersonalizada: true, kitsPerProduct: 5, productionItems: 50 },
    },
    {
      id: "pro", nome: "Pro", resumo: "Para o creator ativo",
      precoMensalCents: 5990, precoAnualCents: 59900, precoMensal: "R$ 59,90", precoAnual: "R$ 599,00",
      bullets: ["100 kits de conteúdo por mês", "200 buscas de IA por dia", "Variações do roteiro (a cada 30s)", "Roteiros salvos ilimitados", "Produção ilimitada", "Suporte prioritário em 24h"],
      destaque: true,
      limits: { searchesPerDay: 200, kitsPerMonth: 100, variations: true, variationCooldownSeconds: 30, vozPersonalizada: true, kitsPerProduct: null, productionItems: null },
    },
    {
      id: "scale", nome: "Scale", resumo: "Para duplas e agências",
      precoMensalCents: 14900, precoAnualCents: 149000, precoMensal: "R$ 149,00", precoAnual: "R$ 1.490,00",
      bullets: ["300 kits de conteúdo por mês", "500 buscas de IA por dia", "3 assentos", "Suporte dedicado", "Exportação CSV"],
      destaque: false,
      limits: { searchesPerDay: 500, kitsPerMonth: 300, variations: true, variationCooldownSeconds: 30, vozPersonalizada: true, kitsPerProduct: null, productionItems: null },
    },
    {
      id: "enterprise", nome: "Enterprise", resumo: "Para operações maiores",
      precoMensalCents: null, precoAnualCents: null, precoMensal: null, precoAnual: null,
      bullets: ["Fair use de 1.000 kits/mês", "Buscas de IA ilimitadas (fair use)", "10+ assentos", "SLA e onboarding assistido"],
      destaque: false,
      limits: { searchesPerDay: null, kitsPerMonth: 1000, variations: true, variationCooldownSeconds: 30, vozPersonalizada: true, kitsPerProduct: null, productionItems: null },
    },
  ],
};

const FAQS = [
  {
    q: "Posso cancelar quando quiser?",
    a: "Sim, em um clique na sua conta — sem multa e sem ligação. Você continua com acesso até o fim do período já pago e nada é apagado.",
  },
  {
    q: "Como funciona o pagamento?",
    a: "PIX ou cartão, com cobrança recorrente no período escolhido e recibo por email. No plano anual, você paga 10 meses e leva 12.",
  },
  {
    q: "Meus roteiros ficam salvos se eu cancelar?",
    a: "Ficam. Seu histórico continua visível e nada é apagado — para voltar a criar novos roteiros, é só reativar a assinatura.",
  },
  {
    q: "Tem garantia?",
    a: `Você começa com ${FALLBACK.trial_days} dias de Pro por nossa conta, sem cartão. Se não fizer sentido, é só não assinar: nada é cobrado sem você decidir.`,
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

const PLAN_OUTCOME: Record<PaidPlan, string> = {
  essencial: "Teste ideias de produto e mantenha seus primeiros vídeos organizados.",
  pro: "Crie roteiros com frequência e acompanhe cada vídeo até a publicação.",
  scale: "Divida a criação entre três pessoas e acompanhe a produção em equipe.",
};

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
  trialing: "Trial",
  canceled: "Cancelado",
  past_due: "Pagamento pendente",
  inactive: "",
};

export default function PricingPage() {
  const router = useRouter();
  const [catalog, setCatalog] = useState<BillingCatalogResponse | null>(null);
  const [sub, setSub] = useState<BillingSubscriptionSummary | null>(null);
  const [accountPlan, setAccountPlan] = useState<AccountPlan | null>(null);
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [period, setPeriod] = useState<Period>("annual");
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

  const data = catalog ?? FALLBACK;
  const checkoutEnabled = catalog?.enabled === true;
  const loggedIn = authState === "authenticated";
  const plans = data.plans.filter((p) => p.id !== "enterprise");
  const enterprise = data.plans.find((p) => p.id === "enterprise");
  const hasActiveSub = sub?.has_active_subscription === true;
  const paidPlan = sub && sub.plan && sub.plan !== "free" ? sub.plan : null;
  const currentPlanName = displayPlanName(accountPlan?.nome || sub?.plan_label);
  const currentPlanStatus = accountPlan?.status || sub?.status;

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
      const result = await api<{ url: string }>("/billing/checkout", accessToken, {
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

  function planCta(p: (typeof plans)[number]) {
    if (authState === "checking") {
      return { label: "Verificando sua conta…", disabled: true, onClick: undefined as (() => void) | undefined };
    }
    const current = hasActiveSub && paidPlan === p.id && sub?.period === period;
    if (current) {
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
        ? currentPlanStatus === "trialing" || currentPlanName !== "Sem plano"
          ? { label: "Usar meu acesso", disabled: false, onClick: () => router.push("/app") }
          : { label: "Falar com suporte", disabled: false, onClick: () => router.push("/app/suporte") }
        : { label: "Começar trial grátis", disabled: false, onClick: () => goToSignup(p.id as PaidPlan) };
    }
    return {
      label: busy === p.id ? "Abrindo pagamento…" : `Assinar ${p.nome}`,
      disabled: busy !== null,
      onClick: () => void subscribe(p.id as PaidPlan),
    };
  }

  return (
    <div className="tt-pricing">
      <PublicNav page="pricing" />

      <main>
        <section className="tt-pricing-hero">
          <h1>Escolha seu plano.</h1>
          <p className="tt-pricing-sub">
            Encontre o produto e receba um plano de gravação em 8 partes, do roteiro à publicação.
          </p>
          <p className="tt-pricing-trial-chip">
            {data.trial_days} dias de Pro por nossa conta · sem cartão de crédito
          </p>
          {!checkoutEnabled && <p className="tt-pricing-availability">O trial de Pro começa no cadastro. As assinaturas dos planos ainda não estão abertas.</p>}
        </section>

        {loggedIn && (
          <section className="tt-pricing-current" aria-label="Seu plano atual">
            <div>
              <strong>
                Seu plano: {currentPlanName}
              </strong>
              <span>
                {currentPlanStatus === "trialing" && (accountPlan?.trial_ends_at || sub?.trial_ends_at)
                  ? `Trial Pro até ${fmtDate(accountPlan?.trial_ends_at || sub?.trial_ends_at)}`
                  : sub?.current_period_end
                    ? `${STATUS_LABEL[sub?.status ?? ""] || "Ativo"} · renova em ${fmtDate(sub.current_period_end)}`
                    : currentPlanName === "Sem plano" ? "Escolha um plano para começar" : "Acesso disponível na sua conta"}
                {sub?.cancel_at_period_end && sub?.current_period_end
                  ? ` · acesso até ${fmtDate(sub.current_period_end)}`
                  : ""}
              </span>
              {sub?.pending_plan_label && (
                <span className="tt-pricing-current-pending">
                  Mudança para {sub.pending_plan_label} agendada para o próximo ciclo
                </span>
              )}
            </div>
            <Link className="tt-pricing-manage" href="/app/conta">Gerenciar na conta</Link>
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
              {plans.every((plan) => plan.precoMensalCents != null && plan.precoAnualCents === plan.precoMensalCents * 10) && <span className="tt-pricing-badge">2 meses grátis</span>}
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

        <section className="tt-pricing-grid" aria-label="Planos e preços">
          {plans.map((p) => {
            const cta = planCta(p);
            const amount = period === "annual" ? p.precoAnual : p.precoMensal;
            const equivalent = period === "annual" ? monthlyEquivalent(p.precoAnualCents) : null;
            const bullets = p.id === "scale"
              ? [...p.bullets, ...(!p.bullets.some((item) => /roteiros salvos/i.test(item)) && p.limits.kitsPerProduct === null ? ["Roteiros salvos ilimitados"] : []), ...(!p.bullets.some((item) => /produção ilimitada/i.test(item)) && p.limits.productionItems === null ? ["Produção ilimitada"] : [])]
              : p.bullets;
            return (
              <article key={p.id} className={`tt-price-card${p.destaque ? " is-featured" : ""}`}>
                {p.destaque && <span className="tt-price-seal">Mais escolhido</span>}
                <header>
                  <h2>{p.nome}</h2>
                  <p>{p.resumo}</p>
                </header>
                <div className="tt-price-amount">
                  {amount ?? "Sob consulta"}
                  {amount && <small>{period === "annual" ? "/ano" : "/mês"}</small>}
                </div>
                {equivalent && (
                  <p className="tt-price-equivalent"><s>{p.precoMensal}/mês</s> Equivale a {equivalent}/mês, cobrado uma vez por ano</p>
                )}
                <div className="tt-price-outcome">
                  <span>Na prática</span>
                  <p>{PLAN_OUTCOME[p.id as PaidPlan] || p.resumo}</p>
                </div>
                <ul className="tt-price-bullets">
                  {bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  className={`tt-price-cta${p.destaque ? "" : " is-ghost"}`}
                  disabled={cta.disabled}
                  onClick={cta.onClick}
                >
                  {cta.label}
                </button>
              </article>
            );
          })}
        </section>

        {enterprise && (
          <section className="tt-enterprise-band" aria-label="Plano Enterprise">
            <div>
              <strong>{enterprise.nome} · sob consulta</strong>
              <p>Preço e período de cobrança definidos em proposta.</p>
              <p>{enterprise.bullets.join(" · ")}</p>
            </div>
            <Link className="tt-enterprise-cta" href="/app/suporte">Falar sobre Enterprise</Link>
          </section>
        )}

        <section className="tt-compare">
          <details open>
            <summary>Comparar todos os recursos</summary>
            <div className="tt-compare-scroll">
              <table>
                <caption className="sr-only">Comparação de recursos por plano</caption>
                <thead>
                  <tr>
                    <th scope="col">Recurso</th>
                    <th scope="col">Essencial</th>
                    <th scope="col">Pro</th>
                    <th scope="col">Scale</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><th scope="row">Teste grátis</th><td colSpan={3}>7 dias de Pro completo, sem cartão de crédito</td></tr>
                  <tr><th scope="row">Kits de conteúdo</th><td>30/mês</td><td>100/mês</td><td>300/mês</td></tr>
                  <tr><th scope="row">Buscas de IA</th><td>50/dia</td><td>200/dia</td><td>500/dia</td></tr>
                  <tr><th scope="row">Gerar outra versão</th><td>a cada 60s</td><td>a cada 30s</td><td>a cada 30s</td></tr>
                  <tr><th scope="row">Voz personalizada</th><td>✓</td><td>✓</td><td>✓</td></tr>
                  <tr><th scope="row">Roteiros salvos por produto</th><td>5</td><td>ilimitado</td><td>ilimitado</td></tr>
                  <tr><th scope="row">Itens na produção</th><td>50</td><td>ilimitado</td><td>ilimitado</td></tr>
                  <tr><th scope="row">Assentos</th><td>1</td><td>1</td><td>3</td></tr>
                  <tr><th scope="row">Exportação CSV</th><td>—</td><td>✓</td><td>✓</td></tr>
                  <tr><th scope="row">Suporte</th><td>email 48h</td><td>prioritário 24h</td><td>dedicado</td></tr>
                  <tr><th scope="row">Enterprise</th><td colSpan={3}>1.000 kits/mês (fair use) · buscas ilimitadas · 10+ assentos · SLA</td></tr>
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
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="tt-pricing-trust" aria-label="Garantias">
          <span>Sem cartão no trial</span>
          <span>Cancele quando quiser</span>
          <span>7 dias de arrependimento (CDC)</span>
          <span>Seus kits continuam seus</span>
        </section>
      </main>

      <footer className="tt-pricing-footer">
        <span>© 2026 TemTrend</span>
        <nav aria-label="Links">
          <Link href="/">Início</Link>
          <Link href="/app">Entrar</Link>
          <Link href="/termos">Termos de uso</Link>
          <Link href="/privacidade">Privacidade</Link>
          <Link href="/reembolso">Reembolso</Link>
        </nav>
      </footer>
    </div>
  );
}
