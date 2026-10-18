import { expect, test } from "@playwright/test";

const userId = "11111111-1111-4111-8111-111111111111";
const creatorId = "22222222-2222-4222-8222-222222222222";
const productId = "33333333-3333-4333-8333-333333333333";
const ticketId = "bbbb2222-2222-4222-8222-222222222222";
const futureIso = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();

const supportTicket = {
  id: ticketId,
  subject: "Não consigo gerar roteiro",
  category: "problema",
  status: "open",
  last_message_at: "2026-10-17T14:30:00.000Z",
  created_at: "2026-10-17T14:30:00.000Z",
  creator_id: creatorId,
  creator_email: "creator@temtrend.test",
  creator_nome: "Creator Teste",
};

function fakeJwt() {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: userId, role: "authenticated", email: "admin@temtrend.test", exp: Math.floor(Date.now() / 1000) + 3600 })}.signature`;
}

test("admin organiza operação, catálogo e creators", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const token = fakeJwt();
  await page.addInitScript(({ tokenValue, id }) => {
    // Sem persistência, o store lê a sessão deste hook (localStorage é ignorado).
    (window as unknown as { __TT_E2E_SESSION__?: unknown }).__TT_E2E_SESSION__ = {
      access_token: tokenValue,
      refresh_token: "refresh-token",
      user: { id, email: "admin@temtrend.test" },
    };
  }, { tokenValue: token, id: userId });

  await page.route("**/auth/v1/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: userId, email: "admin@temtrend.test", role: "authenticated", aud: "authenticated", app_metadata: {}, user_metadata: { full_name: "Admin TemTrend" } }) });
  });

  let supportReplyBody: unknown = null;
  let supportStatusBody: unknown = null;

  await page.route("http://localhost:3333/**", async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (url.pathname === "/me") {
      return route.fulfill({ json: { user_id: userId, creator: null, onboarding_completo: true, is_admin: true } });
    }
    if (url.pathname === "/admin/dashboard") {
      return route.fulfill({ json: { total_creators: 1, creators_ativos: 1, total_produtos: 2, produtos_ativos: 1, total_content_kits: 4, oportunidades_salvas: 7, conteudos_publicados: 3, suporte_abertos: 1, assinaturas_ativas: 1, ai_classify_calls: 12, ai_generate_calls: 8, ai_classify_tokens: 2200, ai_generate_tokens: 5100 } });
    }
    if (url.pathname === "/admin/products") {
      return route.fulfill({ json: [
        { id: productId, produto_externo_id: "1731916815699052495", nome: "Reparador de Pontas Gloss", categoria: "Cabelos", imagem_url: "https://example.com/product.webp", loja_nome: "Semélle", preco_texto: "R$ 10,99", unidades_vendidas_periodo: 25649, crescimento_vendas_percentual: 12.15, receita_periodo_brl: 269924.92, ranking_origem: 1, tiktok_shop_url: "https://shop.tiktok.com/product", status: "ativo", destaque: true },
        { id: "44444444-4444-4444-8444-444444444444", produto_externo_id: "1736183075219736333", nome: "Kit Depilador Elétrico", categoria: "Beleza", loja_nome: "HAOBI", preco_texto: "R$ 36,99", unidades_vendidas_periodo: 23341, crescimento_vendas_percentual: 259.15, receita_periodo_brl: 705266.59, ranking_origem: 2, status: "pausado" },
      ] });
    }
    if (url.pathname === "/admin/creators") {
      return route.fulfill({ json: [{ id: creatorId, user_id: userId, nome: "Creator Teste", email: "creator@temtrend.test", nicho: ["Beleza", "Lifestyle"], status: "ativo" }] });
    }
    if (url.pathname === "/admin/billing/summary") {
      return route.fulfill({ json: { active: 1, trialing: 1, past_due: 0, canceled: 0, pending: 0, failed: 0, mrr_cents: 4970 } });
    }
    if (url.pathname === "/admin/billing/subscriptions") {
      return route.fulfill({ json: { items: [{ id: "cccc3333-3333-4333-8333-333333333333", plan: "pro", plan_label: "Pro", period: "monthly", status: "active", amount_cents: 4970, current_period_end: futureIso, pending_plan_label: null, created_at: "2026-10-01T10:00:00.000Z", creator_nome: "Creator Teste", creator_email: "creator@temtrend.test" }], total: 1, page: 1, limit: 100 } });
    }
    if (url.pathname === "/admin/analytics/funnel") {
      return route.fulfill({ json: { days: 30, events: [{ event_name: "landing_view", total: 120 }, { event_name: "signup_complete", total: 18 }] } });
    }
    if (url.pathname === "/admin/support/tickets" && method === "GET") {
      return route.fulfill({ json: { items: [supportTicket], total: 1, page: 1, limit: 100 } });
    }
    if (url.pathname === `/admin/support/tickets/${ticketId}` && method === "GET") {
      return route.fulfill({ json: { ...supportTicket, messages: [{ id: "m1", author: "creator", body: "Meu roteiro não gera com esse produto", created_at: "2026-10-17T14:30:00.000Z" }] } });
    }
    if (url.pathname === `/admin/support/tickets/${ticketId}/messages` && method === "POST") {
      supportReplyBody = route.request().postDataJSON();
      return route.fulfill({ json: { status: "answered", message: { id: "m2", author: "support", body: "Ajustamos o gerador, tente novamente agora.", created_at: new Date().toISOString() } } });
    }
    if (url.pathname === `/admin/support/tickets/${ticketId}` && method === "PATCH") {
      supportStatusBody = route.request().postDataJSON();
      return route.fulfill({ json: { ok: true, status: "resolved" } });
    }
    return route.fulfill({ status: 404, json: { error: { message: "Not mocked" } } });
  });

  await page.goto("/app/admin");
  await expect(page.getByRole("heading", { name: /controle a operação/i })).toBeVisible();
  await expect(page.getByText("Resumo da plataforma")).toBeVisible();
  await expect(page.getByText("Produtos ativos", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /^produtos/i }).click();
  await expect(page.getByPlaceholder(/buscar produto/i)).toBeVisible();
  await expect(page.getByText("Reparador de Pontas Gloss", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /adicionar produto/i }).click();
  await expect(page.getByRole("heading", { name: /adicionar ao catálogo/i })).toBeVisible();
  await page.getByRole("button", { name: /fechar formulário/i }).click();
  await page.getByPlaceholder(/buscar produto/i).fill("depilador");
  await expect(page.getByText("Kit Depilador Elétrico", { exact: true })).toBeVisible();
  await expect(page.getByText("Reparador de Pontas Gloss", { exact: true })).toBeHidden();

  await page.getByRole("button", { name: /^creators/i }).click();
  await expect(page.getByText("Creator Teste", { exact: true })).toBeVisible();
  await expect(page.getByText("creator@temtrend.test", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /^assinaturas/i }).click();
  await expect(page.getByRole("heading", { name: "Assinaturas" })).toBeVisible();
  await expect(page.getByText("MRR estimado")).toBeVisible();
  await expect(page.getByRole("cell", { name: "Pro", exact: true })).toBeVisible();
  await expect(page.getByText("Ativa", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /^suporte/i }).click();
  await expect(page.getByRole("heading", { name: "Conversas do suporte" })).toBeVisible();
  await page.getByRole("button", { name: /Não consigo gerar roteiro/ }).click();
  await expect(page.getByText("Meu roteiro não gera com esse produto")).toBeVisible();
  await page.getByPlaceholder(/Escreva a resposta/).fill("Ajustamos o gerador, tente novamente agora.");
  await page.getByRole("button", { name: "Responder" }).click();
  await expect(page.getByText("Ajustamos o gerador, tente novamente agora.")).toBeVisible();
  expect(supportReplyBody).toEqual({ body: "Ajustamos o gerador, tente novamente agora." });
  await page.getByRole("button", { name: "Marcar resolvida" }).click();
  await expect(page.getByText("Resolvido").first()).toBeVisible();
  expect(supportStatusBody).toEqual({ status: "resolved" });

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("admin-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: /^visão geral/i }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: /^produtos/i }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: /adicionar produto/i }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: /^assinaturas/i }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: /^suporte/i }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
