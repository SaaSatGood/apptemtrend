import { expect, test, type Page } from "@playwright/test";

// Fixtures isoladas: nada aqui toca serviços reais.
const userId = "11111111-1111-4111-8111-111111111111";
const futureIso = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();

const limits = (overrides: Partial<Record<string, unknown>> = {}) => ({
  searchesPerDay: null,
  searchesPerWeek: null,
  kitsPerMonth: null,
  kitsPerWeek: null,
  variations: true,
  variationCooldownSeconds: 30,
  vozPersonalizada: true,
  kitsPerProduct: null,
  productionItems: null,
  ...overrides,
});

const proPlan = {
  id: "pro",
  nome: "Pro",
  resumo: "Para criar sem contar roteiros",
  precoMensalCents: 4990,
  precoAnualCents: 49900,
  precoMensal: "R$ 49,90",
  precoAnual: "R$ 499,00",
  precoLancamentoMensalCents: 3990,
  precoLancamentoAnualCents: 39900,
  precoLancamentoMensal: "R$ 39,90",
  precoLancamentoAnual: "R$ 399,00",
  bullets: ["Kits de conteúdo ilimitados", "Buscas de IA ilimitadas", "Voz personalizada no roteiro"],
  destaque: true,
  limits: limits(),
};

const enterprisePlan = {
  id: "enterprise",
  nome: "Enterprise",
  resumo: "Para operações com necessidades específicas",
  precoMensalCents: null,
  precoAnualCents: null,
  precoMensal: null,
  precoAnual: null,
  precoLancamentoMensalCents: null,
  precoLancamentoAnualCents: null,
  precoLancamentoMensal: null,
  precoLancamentoAnual: null,
  bullets: ["Condições definidas em conversa", "Avaliação do seu volume de criação"],
  destaque: false,
  limits: limits(),
};

const launchOffer = {
  active: true,
  seats_total: 100,
  seats_left: 73,
  monthly_cents: 3990,
  annual_cents: 39900,
};

const catalog = {
  enabled: true,
  trial_days: 0,
  free: { searches_per_week: 100, kits_per_week: 10, searches_total: 100, kits_total: 10 },
  launch: launchOffer,
  plans: [proPlan, enterprisePlan],
};

const catalogWithoutLaunch = { ...catalog, launch: null };

async function withSession(page: Page, { ready = true }: { ready?: boolean } = {}) {
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
  await page.route("http://localhost:3333/me", (route) => route.fulfill({
    json: {
      user_id: userId,
      creator: ready ? { id: userId, plan: "free", plan_status: "active" } : null,
      onboarding_completo: ready,
      is_admin: false,
    },
  }));
}

test("planos: catálogo único, lançamento, comparação e FAQ abrem para visitante", async ({ page }) => {
  await page.route("http://localhost:3333/billing/plans", (route) => route.fulfill({ json: catalog }));
  await page.goto("/planos");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Comece grátis");
  await expect(page.getByRole("heading", { name: "Grátis", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pro", exact: true })).toBeVisible();
  await expect(page.getByText("Preço de lançamento", { exact: true })).toBeVisible();
  await expect(page.locator("#plan-pro .tt-price-amount")).toContainText("R$ 399,00");
  await page.getByRole("button", { name: "Mensal" }).click();
  await expect(page.locator("#plan-pro .tt-price-amount")).toContainText("R$ 39,90");
  await expect(page.locator(".tt-launch-band")).toContainText("Restam 73 de 100 vagas");
  await expect(page.getByRole("link", { name: /Converse com o suporte interno/ })).toBeVisible();
  const trialChip = page.locator(".tt-pricing-trial-chip");
  await expect(trialChip).toContainText(/Comece grátis/);
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Pro" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Grátis" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Enterprise" })).toHaveCount(0);
  await expect(page.locator(".tt-faq-pricing details")).toHaveCount(7);
  await expect(page.getByText("Cancele quando quiser")).toBeVisible();
  await expect(page.getByRole("link", { name: "Reembolso" })).toBeVisible();
  // Sem conta não há assinatura: o CTA leva ao cadastro e o checkout não é chamado.
  let checkoutCalled = false;
  await page.route("http://localhost:3333/billing/checkout", (route) => {
    checkoutCalled = true;
    return route.fulfill({ json: { url: "http://localhost:3000/pagamento-teste" } });
  });
  await expect(page.getByRole("button", { name: "Assinar com PIX" })).toHaveCount(0);
  await page.getByRole("button", { name: "Criar conta para assinar" }).click();
  await expect(page).toHaveURL(/\/descobrir\?mode=signup/);
  expect(checkoutCalled).toBe(false);
});

test("planos: assinante vê o plano atual e mantém o ciclo", async ({ page }) => {
  await withSession(page);
  await page.route("http://localhost:3333/billing/plans", (route) => route.fulfill({ json: catalogWithoutLaunch }));
  await page.route("http://localhost:3333/billing/subscription", (route) => route.fulfill({
    json: {
      enabled: true,
      plan: "pro",
      plan_label: "Pro",
      status: "active",
      period: "annual",
      trial_ends_at: null,
      current_period_end: futureIso,
      cancel_at_period_end: false,
      has_active_subscription: true,
      payment_mode: "recurring",
      launch_price: false,
      renewal_due: false,
      pending_plan: null,
      pending_plan_label: null,
      pending_period: null,
      limits: limits(),
      usage: {
        kits_total: 12,
        kits_month: 12,
        kits_limit: null,
        kits_limit_period: "month",
        searches_today: 4,
        searches_limit: null,
      },
    },
  }));
  await page.goto("/planos");
  await expect(page.getByText("Seu plano: Pro")).toBeVisible();
  await expect(page.getByRole("button", { name: "Mensal" })).toBeDisabled();
  await expect(page.getByRole("button", { name: /Anual/ })).toBeDisabled();
  await expect(page.getByText("Trocas de plano mantêm seu ciclo de cobrança atual.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Seu plano atual" })).toBeDisabled();
  await expect(page.locator("#plan-pro .tt-price-amount")).toContainText("R$ 499,00");
});

test("planos: assinatura por período vencendo mostra renovação e abre o checkout", async ({ page }) => {
  await withSession(page);
  await page.route("http://localhost:3333/billing/plans", (route) => route.fulfill({ json: catalog }));
  await page.route("http://localhost:3333/billing/subscription", (route) => route.fulfill({
    json: {
      enabled: true,
      plan: "pro",
      plan_label: "Pro",
      status: "active",
      period: "monthly",
      trial_ends_at: null,
      current_period_end: futureIso,
      cancel_at_period_end: false,
      has_active_subscription: true,
      payment_mode: "one_time",
      launch_price: true,
      renewal_due: true,
      pending_plan: null,
      pending_plan_label: null,
      pending_period: null,
      limits: limits(),
      usage: {
        kits_total: 12,
        kits_month: 12,
        kits_limit: null,
        kits_limit_period: "month",
        searches_today: 4,
        searches_limit: null,
      },
    },
  }));
  let checkoutBody: unknown = null;
  await page.route("http://localhost:3333/billing/checkout", (route) => {
    checkoutBody = route.request().postDataJSON();
    return route.fulfill({ json: { url: "http://localhost:3000/pagamento-teste", mode: "one_time", launch: true } });
  });
  await page.route("http://localhost:3000/pagamento-teste", (route) => route.fulfill({
    body: "Pagamento",
    contentType: "text/html",
  }));

  await page.goto("/planos");
  await expect(page.locator(".tt-pricing-current")).toContainText(/preço de lançamento/i);
  await expect(page.getByText(/Seu período termina em/)).toBeVisible();
  await page.getByRole("button", { name: "Renovar com PIX" }).click();
  await expect(page).toHaveURL(/pagamento-teste/);
  expect(checkoutBody).toEqual({ plan: "pro", period: "monthly", method: "pix" });
});

test("planos: usuário logado sem assinatura abre o pagamento sem voltar ao cadastro", async ({ page }) => {
  await withSession(page);
  await page.route("http://localhost:3333/billing/plans", (route) => route.fulfill({ json: catalogWithoutLaunch }));
  await page.route("http://localhost:3333/billing/subscription", (route) => route.fulfill({
    json: {
      enabled: true,
      plan: "free",
      plan_label: "Sem plano",
      status: "inactive",
      period: null,
      has_active_subscription: false,
    },
  }));
  let checkoutBody: unknown = null;
  await page.route("http://localhost:3333/billing/checkout", (route) => {
    checkoutBody = route.request().postDataJSON();
    return route.fulfill({ json: { url: "http://localhost:3000/pagamento-teste", mode: "one_time", launch: false } });
  });
  await page.route("http://localhost:3000/pagamento-teste", (route) => route.fulfill({
    body: "Pagamento",
    contentType: "text/html",
  }));

  await page.goto("/planos");
  await expect(page.getByRole("link", { name: "Ir para o app" })).toBeVisible();
  await page.getByRole("button", { name: "Assinar com PIX" }).click();
  await expect(page).toHaveURL(/pagamento-teste/);
  expect(checkoutBody).toEqual({ plan: "pro", period: "annual", method: "pix" });
});

test("planos: conta sem cadastro completo não inicia checkout e volta ao onboarding", async ({ page }) => {
  await withSession(page, { ready: false });
  await page.route("http://localhost:3333/billing/plans", (route) => route.fulfill({ json: catalogWithoutLaunch }));
  let checkoutCalled = false;
  await page.route("http://localhost:3333/billing/checkout", (route) => {
    checkoutCalled = true;
    return route.fulfill({ json: { url: "http://localhost:3000/pagamento-teste" } });
  });

  await page.goto("/planos");
  await expect(page.getByRole("button", { name: "Complete seu cadastro para assinar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Assinar com PIX" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Pagar com cartão" })).toHaveCount(0);

  await page.getByRole("button", { name: "Complete seu cadastro para assinar" }).click();
  await expect(page).toHaveURL(/\/descobrir\?next=/);
  expect(checkoutCalled).toBe(false);
});

test("app: conta gratuita não exibe aviso de trial", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
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
            plan: "free",
            plan_status: "active",
            trial_ends_at: null,
          },
          onboarding_completo: true,
          is_admin: false,
        },
      });
    }
    if (path === "/creator-content") return route.fulfill({ json: [] });
    return route.fulfill({ status: 404, json: { error: { message: `Unmocked: ${path}` } } });
  });
  await page.goto("/descobrir");
  await expect(page.getByText(/Trial Pro/)).toHaveCount(0);
  const appTitleFont = await page.getByRole("heading", { level: 1 }).first().evaluate((element) =>
    getComputedStyle(element).fontFamily
  );
  expect(appTitleFont).toContain("Bricolage");
  const appNav = page.getByRole("navigation", { name: "Navegação da plataforma" });
  for (const label of ["Descobrir", "Meus conteúdos", "Resultados", "Conta"]) {
    await expect(appNav.getByRole("link", { name: label })).toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath("app-mobile-nav.png") });
});
