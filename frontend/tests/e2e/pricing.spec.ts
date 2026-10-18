import { expect, test, type Page } from "@playwright/test";

// Fixtures isoladas: nada aqui toca serviços reais.
const userId = "11111111-1111-4111-8111-111111111111";
const futureIso = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();
const trialIso = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();

const limits = (overrides: Partial<Record<string, unknown>> = {}) => ({
  searchesPerDay: 10,
  kitsPerMonth: null,
  variations: false,
  variationCooldownSeconds: 0,
  vozPersonalizada: false,
  kitsPerProduct: 1,
  productionItems: 5,
  ...overrides,
});

const planMeta = (id: string, nome: string, destaque = false) => ({
  id,
  nome,
  resumo: `Resumo do ${nome}`,
  precoMensalCents: 2990,
  precoAnualCents: 29900,
  precoMensal: "R$ 29,90",
  precoAnual: "R$ 299,00",
  bullets: ["30 kits por mês", "50 buscas por dia"],
  destaque,
  limits: limits({ kitsPerMonth: 30 }),
});

const catalog = {
  enabled: true,
  trial_days: 7,
  plans: [
    planMeta("essencial", "Essencial"),
    planMeta("pro", "Pro", true),
    planMeta("scale", "Scale"),
    { ...planMeta("enterprise", "Enterprise"), precoMensalCents: null, precoAnualCents: null, precoMensal: null, precoAnual: null },
  ],
};

async function withSession(page: Page) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: userId, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.signature`;
  await page.addInitScript(({ token, userId }) => {
    (window as unknown as { __TT_E2E_SESSION__?: unknown }).__TT_E2E_SESSION__ = {
      access_token: token,
      refresh_token: "fixture",
      user: { id: userId, email: "creator@temtrend.test" },
    };
  }, { token, userId });
  await page.route("**/auth/v1/**", (route) => route.fulfill({ json: { id: userId, email: "creator@temtrend.test", user_metadata: { full_name: "Rafa" } } }));
}

test("planos: catálogo, comparação e FAQ abrem para visitante", async ({ page }) => {
  await page.goto("/planos");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Comece");
  await expect(page.getByRole("heading", { name: "Essencial", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pro", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Scale", exact: true })).toBeVisible();
  await expect(page.getByText("Mais escolhido")).toBeVisible();
  const trialChip = page.locator(".tt-pricing-trial-chip");
  await expect(trialChip).toContainText(/7 dias de Pro por nossa conta/);
  await expect(trialChip).toContainText(/sem cartão de crédito/);
  await page.getByText("Comparar todos os recursos").click();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Grátis" })).toHaveCount(0);
  await expect(page.locator(".tt-faq-pricing details")).toHaveCount(6);
  await expect(page.getByText("Cancele quando quiser")).toBeVisible();
  await expect(page.getByRole("link", { name: "Reembolso" })).toBeVisible();
  // Sem assinatura: CTA leva ao cadastro.
  await page.getByRole("button", { name: /Criar conta grátis/ }).first().click();
  await expect(page).toHaveURL(/\/app\?mode=signup/);
});

test("planos: assinante vê plano atual e agenda a troca", async ({ page }) => {
  await withSession(page);
  await page.route("http://localhost:3333/billing/plans", (route) => route.fulfill({ json: catalog }));
  await page.route("http://localhost:3333/billing/subscription", (route) => route.fulfill({
    json: {
      enabled: true,
      plan: "essencial",
      plan_label: "Essencial",
      status: "active",
      period: "annual",
      trial_ends_at: null,
      current_period_end: futureIso,
      cancel_at_period_end: false,
      has_active_subscription: true,
      pending_plan: null,
      pending_plan_label: null,
      pending_period: null,
      limits: limits({ kitsPerMonth: 30 }),
      usage: {
        kits_total: 12,
        kits_month: 12,
        kits_limit: 30,
        kits_limit_period: "month",
        searches_today: 4,
        searches_limit: 50,
      },
    },
  }));
  let changeBody: unknown = null;
  await page.route("http://localhost:3333/billing/change-plan", (route) => {
    changeBody = route.request().postDataJSON();
    return route.fulfill({ json: { scheduled: true, effective_at: futureIso, plan: "pro", period: "annual" } });
  });
  await page.goto("/planos");
  await expect(page.getByText("Seu plano: Essencial")).toBeVisible();
  await expect(page.getByRole("button", { name: "Seu plano atual" })).toBeDisabled();
  await page.getByRole("button", { name: /Mudar para Pro/ }).click();
  await expect(page.getByText(/Mudança para o Pro agendada/)).toBeVisible();
  expect(changeBody).toEqual({ plan: "pro", period: "annual" });
});

test("app: faixa de trial ativo leva aos planos", async ({ page }) => {
  await withSession(page);
  await page.route("http://localhost:3333/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/me") {
      return route.fulfill({
        json: {
          user_id: userId,
          creator: {
            id: userId,
            estilos_conteudo: [],
            temas_interesse: [],
            plan: "pro",
            plan_status: "trialing",
            trial_ends_at: trialIso,
          },
          onboarding_completo: true,
          is_admin: false,
        },
      });
    }
    if (path === "/creator-content") return route.fulfill({ json: [] });
    return route.fulfill({ status: 404, json: { error: { message: `Unmocked: ${path}` } } });
  });
  await page.goto("/app");
  await expect(page.getByText(/Trial Pro · \d+ dias restantes/)).toBeVisible();
  await page.getByRole("link", { name: "Ver planos" }).click();
  await expect(page).toHaveURL(/\/planos$/);
});
