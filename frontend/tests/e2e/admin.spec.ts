import { expect, test } from "@playwright/test";

const userId = "11111111-1111-4111-8111-111111111111";
const creatorId = "22222222-2222-4222-8222-222222222222";
const productId = "33333333-3333-4333-8333-333333333333";
const pausedProductId = "44444444-4444-4444-8444-444444444444";
const ticketId = "bbbb2222-2222-4222-8222-222222222222";
const leadId = "cccc4444-4444-4444-8444-444444444444";
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

const activeProduct = {
  id: productId,
  produto_externo_id: "1731916815699052495",
  nome: "Reparador de Pontas Gloss",
  categoria: "Cabelos",
  imagem_url: "https://example.com/product.webp",
  loja_nome: "Semélle",
  preco_texto: "R$ 10,99",
  unidades_vendidas_periodo: 25649,
  crescimento_vendas_percentual: 12.15,
  receita_periodo_brl: 269924.92,
  ranking_origem: 1,
  tiktok_shop_url: "https://shop.tiktok.com/product",
  status: "ativo",
  destaque: true,
};

const pausedProduct = {
  id: pausedProductId,
  produto_externo_id: "1736183075219736333",
  nome: "Kit Depilador Elétrico",
  categoria: "Beleza",
  loja_nome: "HAOBI",
  preco_texto: "R$ 36,99",
  unidades_vendidas_periodo: 23341,
  crescimento_vendas_percentual: 259.15,
  receita_periodo_brl: 705266.59,
  ranking_origem: 2,
  status: "pausado",
};

const lead = {
  id: leadId,
  nome: "Marca Aurora",
  email: "contato@aurora.test",
  telefone: "(11) 99999-0000",
  mensagem: "Queremos creators para a linha de skincare.",
  status: "novo",
  source: "landing_marcas",
  created_at: "2026-11-14T12:00:00.000Z",
  updated_at: null,
};

function fakeJwt() {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: userId, role: "authenticated", email: "admin@temtrend.test", exp: Math.floor(Date.now() / 1000) + 3600 })}.signature`;
}

test("admin organiza operação, catálogo, creators, leads, IA e suporte", async ({ page }, testInfo) => {
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
  let leadStatusBody: unknown = null;
  let productPatchBody: unknown = null;
  let planGrantBody: unknown = null;
  let deleteAccountBody: unknown = null;

  await page.route("http://localhost:3333/**", async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (url.pathname === "/me") {
      return route.fulfill({ json: { user_id: userId, creator: null, onboarding_completo: true, is_admin: true } });
    }
    if (url.pathname === "/admin/dashboard") {
      return route.fulfill({
        json: {
          total_creators: 1, creators_ativos: 1, creators_bloqueados: 0, creators_trial: 1,
          total_produtos: 2, produtos_ativos: 1, produtos_pausados: 1, produtos_destaque: 1,
          total_content_kits: 4, oportunidades_salvas: 7, conteudos_publicados: 3,
          suporte_abertos: 1, suporte_respondidos: 0, assinaturas_ativas: 1,
          leads_novos: 1, total_leads: 4, leads_qualificados: 1,
          suporte_total: 1, planos_ativos: 1, planos_vencendo: 1,
          ai_classify_calls: 12, ai_generate_calls: 8, ai_classify_tokens: 2200, ai_generate_tokens: 5100,
        },
      });
    }
    if (url.pathname === "/admin/ai-usage") {
      return route.fulfill({
        json: {
          today: { usage_date: "2026-11-15", classify_calls: 12, classify_tokens: 2200, classify_cache_hits: 3, generate_calls: 8, generate_tokens: 5100, generate_retries: 1, store: "database" },
          series: [
            { usage_date: "2026-11-14", classify_calls: 5, classify_tokens: 900, classify_cache_hits: 1, generate_calls: 4, generate_tokens: 1800, generate_retries: 0 },
            { usage_date: "2026-11-15", classify_calls: 12, classify_tokens: 2200, classify_cache_hits: 3, generate_calls: 8, generate_tokens: 5100, generate_retries: 1 },
          ],
          config: {
            provider: "opencode",
            model: "deepseek-v4.1-flash",
            quota_store: "database",
            quotas: { ASSISTANT_PER_DAY: 1000, KIT_PER_DAY: 30, SUPPORT_PER_DAY: 40, FORCE_NEW_COOLDOWN_MS: 30000 },
            billing_enabled: true,
          },
          usage: [
            { usage_date: "2026-11-14", assistant_calls: 5, kit_calls: 4, support_calls: 1, total_tokens: 2700 },
            { usage_date: "2026-11-15", assistant_calls: 12, kit_calls: 8, support_calls: 2, total_tokens: 7300 },
          ],
        },
      });
    }
    if (url.pathname === "/admin/products/categories") {
      return route.fulfill({ json: { items: ["Beleza", "Cabelos"] } });
    }
    if (url.pathname === "/admin/products" && method === "GET") {
      const status = url.searchParams.get("status");
      const q = (url.searchParams.get("q") ?? "").toLowerCase();
      const all = [activeProduct, pausedProduct];
      const filtered = all
        .filter((product) => !status || product.status === status)
        .filter((product) => !q || product.nome.toLowerCase().includes(q));
      return route.fulfill({ json: { items: filtered, total: filtered.length, page: 1, limit: 25 } });
    }
    if (url.pathname === `/admin/products/${productId}` && method === "GET") {
      return route.fulfill({ json: { product: { ...activeProduct, descricao: "Reparador testado" }, content_kits: [] } });
    }
    if (url.pathname === `/admin/products/${pausedProductId}` && method === "PATCH") {
      productPatchBody = route.request().postDataJSON();
      return route.fulfill({ json: { ...pausedProduct, status: "ativo" } });
    }
    if (url.pathname === `/admin/products/${productId}` && method === "PATCH") {
      return route.fulfill({ json: activeProduct });
    }
    if (url.pathname === "/admin/creators") {
      return route.fulfill({
        json: [{
          id: creatorId, user_id: userId, nome: "Creator Teste", email: "creator@temtrend.test",
          nicho: ["Beleza", "Lifestyle"], status: "ativo", plan: "pro", plan_status: "active",
          plan_period: "monthly", current_period_end: futureIso, criado_em: "2026-10-01T10:00:00.000Z",
          plan_active: true, plan_until: futureIso,
        }],
      });
    }
    if (url.pathname === `/admin/creators/${creatorId}/plan` && method === "PATCH") {
      planGrantBody = route.request().postDataJSON();
      return route.fulfill({
        json: {
          creator: { id: creatorId, user_id: userId, plan: "pro", plan_status: "active", plan_period: "monthly", current_period_end: futureIso },
          subscription: { id: "sub-manual", plan: "pro", period: "monthly", status: "active", provider: "manual", current_period_end: futureIso },
        },
      });
    }
    if (url.pathname === `/admin/creators/${creatorId}` && method === "DELETE") {
      deleteAccountBody = route.request().postDataJSON();
      return route.fulfill({ status: 204, body: "" });
    }
    if (url.pathname === `/admin/creators/${creatorId}` && method === "GET") {
      return route.fulfill({
        json: {
          creator: { id: creatorId, user_id: userId, plan: "pro", plan_status: "active", plan_period: "monthly", current_period_end: futureIso },
          nome: "Creator Teste",
          email: "creator@temtrend.test",
          subscriptions: [{ id: "sub-1", plan: "pro", period: "monthly", status: "active", amount_cents: 4990, current_period_end: futureIso, pending_plan: null, created_at: "2026-10-01T10:00:00.000Z" }],
          usage: [{ usage_date: "2026-11-15", assistant_calls: 4, kit_calls: 2, support_calls: 1, total_tokens: 900 }],
          sessions: [{ id: "sess-1", title: "Skincare para o verão", created_at: "2026-11-14T10:00:00.000Z", updated_at: "2026-11-15T10:00:00.000Z" }],
          tickets: [{ id: ticketId, subject: "Não consigo gerar roteiro", status: "open", category: "problema", last_message_at: "2026-10-17T14:30:00.000Z" }],
          counts: { content_kits: 4, discovery_sessions: 7, support_tickets: 1, creator_content: 3, shared_conversations: 1 },
        },
      });
    }
    if (url.pathname === "/admin/leads") {
      return route.fulfill({ json: { items: [lead], total: 1, page: 1, limit: 20 } });
    }
    if (url.pathname === `/admin/leads/${leadId}/status` && method === "PATCH") {
      leadStatusBody = route.request().postDataJSON();
      return route.fulfill({ json: { id: leadId, status: "qualificado", updated_at: futureIso } });
    }
    if (url.pathname === "/admin/billing/summary") {
      return route.fulfill({ json: { active: 1, trialing: 0, past_due: 0, canceled: 0, pending: 1, failed: 0, expiring_7d: 1, creators_total: 1, mrr_cents: 4970 } });
    }
    if (url.pathname === "/admin/billing/subscriptions") {
      return route.fulfill({ json: { items: [{ id: "cccc3333-3333-4333-8333-333333333333", plan: "pro", plan_label: "Pro", period: "monthly", status: "active", provider: "asaas", amount_cents: 4970, current_period_end: futureIso, pending_plan_label: null, created_at: "2026-10-01T10:00:00.000Z", creator_nome: "Creator Teste", creator_email: "creator@temtrend.test" }], total: 1, page: 1, limit: 100 } });
    }
    if (url.pathname === "/admin/analytics/funnel") {
      return route.fulfill({ json: { days: 30, events: [{ event_name: "landing_view", total: 120 }, { event_name: "signup_complete", total: 18 }] } });
    }
    if (url.pathname === "/admin/support/tickets" && method === "GET") {
      return route.fulfill({
        json: {
          items: [supportTicket],
          total: 1,
          page: 1,
          limit: 50,
          counts: { open: 1, answered: 0, resolved: 0, closed: 0 },
        },
      });
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
      return route.fulfill({ json: { ok: true, status: (supportStatusBody as { status?: string })?.status ?? "resolved" } });
    }
    return route.fulfill({ status: 404, json: { error: { message: "Not mocked" } } });
  });

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: /controle a operação/i })).toBeVisible();
  await expect(page.getByText("Resumo da plataforma")).toBeVisible();
  await expect(page.getByText("Creators ativos", { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Leads de marca", { exact: true })).toBeVisible();
  await expect(page.getByText("Leads novos", { exact: true })).toBeVisible();

  // Produtos: busca no servidor, paginação e ações.
  await page.getByRole("button", { name: /^produtos/i }).click();
  await expect(page.getByPlaceholder(/buscar produto/i)).toBeVisible();
  await expect(page.getByText("Reparador de Pontas Gloss", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /adicionar produto/i }).click();
  await expect(page.getByRole("heading", { name: /adicionar ao catálogo/i })).toBeVisible();
  await page.getByRole("button", { name: /fechar formulário/i }).click();
  await page.getByPlaceholder(/buscar produto/i).fill("depilador");
  await expect(page.getByText("Kit Depilador Elétrico", { exact: true })).toBeVisible();
  await expect(page.getByText("Reparador de Pontas Gloss", { exact: true })).toBeHidden();
  await page.getByPlaceholder(/buscar produto/i).fill("");
  await expect(page.getByText("Reparador de Pontas Gloss", { exact: true })).toBeVisible();

  // Ativar produto pausado exige uma chamada PATCH real.
  await page.getByRole("button", { name: /^ativar$/i }).first().click();
  await expect.poll(() => productPatchBody).toEqual({ status: "ativo" });

  // Creators: plano visível, concessão manual e ficha completa.
  await page.getByRole("button", { name: /^creators/i }).click();
  await expect(page.getByText("Creator Teste", { exact: true })).toBeVisible();
  await expect(page.getByText("creator@temtrend.test", { exact: true })).toBeVisible();
  await expect(page.getByText(/Pro · até/)).toBeVisible();
  await expect(page.locator(`text=Com plano ativo`).first()).toBeVisible();
  await expect(page.locator(`text=Vence em 7 dias`).first()).toBeVisible();

  // Filtro por plano.
  await page.getByLabel("Filtrar creators por plano").selectOption("gratis");
  await expect(page.getByText("Nenhum creator corresponde aos filtros.")).toBeVisible();
  await page.getByLabel("Filtrar creators por plano").selectOption("pagos");
  await expect(page.getByText("Creator Teste", { exact: true })).toBeVisible();

  // Conceder plano manual.
  await page.getByRole("button", { name: "Plano", exact: true }).click();
  await expect(page.locator("#admin-plan-title")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("admin-plan-modal.png") });
  await page.getByRole("radio", { name: /Personalizado/i }).check();
  await page.getByLabel("Dias de acesso").fill("120");
  await page.getByRole("button", { name: "Conceder Pro" }).click();
  await expect.poll(() => planGrantBody).toEqual({ plan: "pro", period: "monthly", days: 120 });

  await page.getByRole("button", { name: "Detalhes" }).click();
  await expect(page.locator("#admin-creator-detail")).toBeVisible();
  await expect(page.getByText("Uso de IA · 30 dias")).toBeVisible();
  await expect(page.getByText("Skincare para o verão")).toBeVisible();

  // Exclusão de conta: exige o e-mail exato.
  await page.getByRole("button", { name: /Excluir conta/i }).click();
  await page.getByPlaceholder("email da conta").fill("creator@temtrend.test");
  await page.screenshot({ path: testInfo.outputPath("admin-delete-account.png") });
  await page.getByRole("button", { name: "Excluir definitivamente" }).click();
  await expect.poll(() => deleteAccountBody).toEqual({ confirm_email: "creator@temtrend.test" });

  // Leads: mudança de status persiste.
  await page.getByRole("button", { name: /^leads/i }).click();
  await expect(page.getByRole("heading", { name: "Leads de marca" })).toBeVisible();
  await expect(page.getByText("Marca Aurora")).toBeVisible();
  await page.getByLabel("Status do lead Marca Aurora").selectOption("qualificado");
  await expect.poll(() => leadStatusBody).toEqual({ status: "qualificado" });

  // Assinaturas: carteira, quem tem plano e até quando.
  await page.getByRole("button", { name: /^assinaturas/i }).click();
  await expect(page.getByRole("heading", { name: "Assinaturas" })).toBeVisible();
  await expect(page.getByText("MRR estimado")).toBeVisible();
  await expect(page.getByText("Vencem em 7 dias")).toBeVisible();
  await expect(page.getByRole("cell", { name: "Pro", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("cell", { name: "Asaas" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Válido até" }).first()).toBeVisible();
  await expect(page.getByText("Ativa", { exact: true })).toBeVisible();

  // IA: provedor real e série histórica.
  await page.getByRole("button", { name: /^uso de ia/i }).click();
  await expect(page.getByRole("heading", { name: "Uso de IA" })).toBeVisible();
  await expect(page.getByText("OpenCode", { exact: true })).toBeVisible();
  await expect(page.getByText("deepseek-v4.1-flash")).toBeVisible();
  await expect(page.getByText("Chamadas por dia")).toBeVisible();

  // Suporte: chips de status, busca, responder e resolver.
  await page.getByRole("button", { name: /^suporte/i }).click();
  await expect(page.getByRole("heading", { name: "Conversas do suporte" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Aguardando \d+$/ })).toBeVisible();
  await expect(page.getByLabel("Buscar tickets por assunto")).toBeVisible();
  await page.getByRole("button", { name: /Não consigo gerar roteiro/ }).click();
  await expect(page.getByText("Meu roteiro não gera com esse produto")).toBeVisible();
  await page.getByPlaceholder(/Escreva a resposta/).fill("Ajustamos o gerador, tente novamente agora.");
  await page.getByRole("button", { name: "Responder" }).click();
  await expect(page.getByText("Ajustamos o gerador, tente novamente agora.")).toBeVisible();
  expect(supportReplyBody).toEqual({ body: "Ajustamos o gerador, tente novamente agora." });
  await page.getByRole("button", { name: "Marcar resolvida" }).click();
  await expect(page.getByText("Resolvido").first()).toBeVisible();
  expect(supportStatusBody).toEqual({ status: "resolved" });

  // Deep link por hash mantém a aba escolhida.
  await page.goto("/admin#leads");
  await expect(page.getByRole("heading", { name: "Leads de marca" })).toBeVisible();

  // Celular: nenhuma aba pode estourar a largura.
  await page.setViewportSize({ width: 390, height: 844 });
  for (const label of [/^visão geral/i, /^produtos/i, /^creators/i, /^leads/i, /^assinaturas/i, /^suporte/i, /^uso de ia/i]) {
    await page.getByRole("button", { name: label }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.screenshot({ path: testInfo.outputPath("admin-mobile.png"), fullPage: true });

  // Tablet: grades de toolbar e cards também não podem estourar.
  await page.setViewportSize({ width: 900, height: 1000 });
  for (const label of [/^produtos/i, /^uso de ia/i, /^leads/i]) {
    await page.getByRole("button", { name: label }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.screenshot({ path: testInfo.outputPath("admin-tablet.png"), fullPage: true });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("button", { name: /^visão geral/i }).click();
  await page.screenshot({ path: testInfo.outputPath("admin-overview.png"), fullPage: true });

  // Registro visual das abas para revisão de design.
  for (const [label, file] of [
    [/^produtos/i, "admin-products.png"],
    [/^creators/i, "admin-creators.png"],
    [/^leads/i, "admin-leads.png"],
    [/^assinaturas/i, "admin-billing.png"],
    [/^suporte/i, "admin-support.png"],
    [/^uso de ia/i, "admin-ai.png"],
  ] as const) {
    await page.getByRole("button", { name: label }).click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: testInfo.outputPath(file), fullPage: true });
  }
});
