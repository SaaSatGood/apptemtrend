import { expect, test, type Page } from "@playwright/test";

// All authenticated requests in this suite are isolated fixtures, never live writes.
const userId = "11111111-1111-4111-8111-111111111111";
const productId = "33333333-3333-4333-8333-333333333333";
const kitId = "44444444-4444-4444-8444-444444444444";
const productionId = "55555555-5555-4555-8555-555555555555";
const product = { id: productId, nome: "Organizador de cozinha", categoria: "Casa e cozinha", preco_texto: "R$ 29,90", preco_min_brl: 29.9, comissao_percentual: 15, unidades_vendidas_periodo: 125, imagem_url: "/temtrend-mark.svg", descricao: "Organize seus utensílios e deixe a bancada livre.", tiktok_shop_url: "https://www.tiktok.com/" };
const comparisonProducts = [
  { ...product, comissao_percentual: 15, motivo: "Combina com sua busca" },
  { ...product, id: "66666666-6666-4666-8666-666666666666", nome: "Kit organizador de banheiro", categoria: "Casa", preco_texto: "R$ 80,00", preco_min_brl: 80, comissao_percentual: 20, unidades_vendidas_periodo: 1000 },
  { ...product, id: "77777777-7777-4777-8777-777777777777", nome: "Porta joias para casa", categoria: "Casa", preco_texto: "R$ 19,90", preco_min_brl: 19.9, comissao_percentual: 10.5, unidades_vendidas_periodo: 50 },
  { ...product, id: "88888888-8888-4888-8888-888888888888", nome: "Luminária para vídeo", categoria: "Casa", preco_texto: "R$ 59,90", preco_min_brl: 59.9, comissao_percentual: 30, unidades_vendidas_periodo: 10 },
  { ...product, id: "99999999-9999-4999-8999-999999999999", nome: "Garrafa térmica", categoria: "Casa", preco_texto: "R$ 100,00", preco_min_brl: 100, comissao_percentual: 5, unidades_vendidas_periodo: 200 },
];
const kit = {
  id: kitId, product_id: productId, titulo: "Uma bancada mais organizada",
  descricao: "Produto: Organizador de cozinha. Classificação: RISING. Evidência: FORTE. Público: Pessoas que querem uma cozinha prática. Por que agora: Alta demanda com 125 unidades vendidas no período. Ângulo: Mais espaço na bancada com uma mudança simples. Formato: Antes e depois.",
  hook: "Sua cozinha pode ganhar espaço",
  roteiro: "ROTEIRO PRINCIPAL: mostre a bancada antes e depois da organização.\n3 VARIAÇÕES DE HOOK: 1) Sua bancada vive cheia? 2) Olha quanto espaço eu ganhei. 3) Um detalhe mudou minha cozinha.\nVERSÃO SEM SEGUIDORES: grave só as mãos e o produto.\nDICA DE PUBLICAÇÃO: mostre o resultado na capa.\n5 VARIAÇÕES DE ROTEIRO: A) Antes e depois da bancada B) Teste rápido de organização C) Tour pela cozinha organizada D) Organize a gaveta em três passos E) Demonstre o ganho de espaço.",
  cenas: [
    { tempo: "0–5s", mostre: "Mostre a bancada", fale: "Olha esta ideia", acao_edicao: "Corte para o produto" },
    { tempo: "5–15s", mostre: "Mostre o resultado", fale: "Se quiser garantir o seu, confira se ainda tem disponível no carrinho aqui embaixo", acao_edicao: "Close no produto" },
  ],
  copy: "Uma ideia para sua cozinha.", cta: "Confira o produto no carrinho do vídeo, se ele estiver disponível para você.", hashtags: ["casa", "#organizacao"], audio_sugerido: "Áudio discreto para acompanhar a demonstração.", duracao_seg: 15,
};
const billingCatalog = {
  enabled: true,
  trial_days: 0,
  free: { searches_per_week: 100, kits_per_week: 10, searches_total: 100, kits_total: 10 },
  launch: null,
  plans: [{
    id: "pro", nome: "Pro", resumo: "Para criar sem contar roteiros",
    precoMensalCents: 4990, precoAnualCents: 49900,
    precoMensal: "R$ 49,90", precoAnual: "R$ 499,00",
    precoLancamentoMensalCents: 4990, precoLancamentoAnualCents: 49900,
    precoLancamentoMensal: "R$ 49,90", precoLancamentoAnual: "R$ 499,00",
    bullets: ["Kits de conteúdo ilimitados", "Buscas de IA ilimitadas", "Catálogo completo de produtos", "Variações do roteiro quando quiser"],
    destaque: true,
    limits: {
      searchesPerDay: null, searchesPerWeek: null, kitsPerMonth: null, kitsPerWeek: null,
      variations: true,
      variationCooldownSeconds: 30, vozPersonalizada: true,
      kitsPerProduct: null, productionItems: null,
    },
  }],
};

async function setup(page: Page, options: { saved?: boolean; onboarding?: boolean; failSearch?: boolean; comparison?: boolean; sensitive?: boolean; paid?: boolean; failOnboarding?: boolean; productOverride?: Partial<typeof product>; kitOverride?: Partial<typeof kit> } = {}) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: userId, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.signature`;
  await page.addInitScript(({ token, userId }) => {
    // Sem persistência, o store lê a sessão deste hook (localStorage é ignorado).
    (window as unknown as { __TT_E2E_SESSION__?: unknown }).__TT_E2E_SESSION__ = { access_token: token, refresh_token: "fixture", user: { id: userId, email: "creator@temtrend.test" } };
  }, { token, userId });
  await page.route("**/auth/v1/**", (route) => route.fulfill({ json: { id: userId, email: "creator@temtrend.test", user_metadata: { full_name: "Rafa" } } }));
  let status = options.saved ? "salvo" : "";
  const fixtureProduct = { ...product, ...options.productOverride };
  const fixtureKit = { ...kit, ...options.kitOverride };
  let hasKit = Boolean(options.saved);
  let onboarded = !options.onboarding;
  const creator: Record<string, unknown> = {
    id: userId,
    estilos_conteudo: [] as string[],
    temas_interesse: [] as string[],
    objetivo: null,
    plan: options.paid ? "pro" : "free",
    plan_status: "active",
    current_period_end: options.paid ? new Date(Date.now() + 30 * 86400000).toISOString() : null,
  };
  const onboardingPayloads: Array<Record<string, unknown>> = [];
  const checkoutPayloads: Array<Record<string, unknown>> = [];
  let onboardingFailures = options.failOnboarding ? 1 : 0;
  let searchCalls = 0;
  let lastSearchPayload: Record<string, unknown> | null = null;
  let kitInstructions = "";
  const mutations: string[] = [];
  let searchSequence = 0;
  const savedSearches: Array<{
    id: string;
    query: string;
    message: string;
    products: unknown[];
    needs_clarification: boolean;
    created_at: string;
    updated_at: string;
  }> = [];
  const production = () => ({ id: productionId, creator_id: userId, product_id: productId, content_kit_id: kitId, status, products: fixtureProduct, content_kits: fixtureKit, atualizado_em: "2026-10-09T12:00:00Z" });
  await page.route("http://localhost:3333/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const method = req.method();
    // Telemetria não é mutação de dados: fica fora da lista observada.
    if (method !== "GET" && path !== "/events") mutations.push(`${method} ${path}`);
    if (path === "/me") return route.fulfill({ json: { user_id: userId, creator, onboarding_completo: onboarded, is_admin: false } });
    if (path === "/products") return route.fulfill({ json: [fixtureProduct, { ...product, id: "66666666-6666-4666-8666-666666666666", nome: "Kit de cuidados para cabelo", categoria: "Beleza", preco_min_brl: 79.9, preco_texto: "R$ 79,90" }] });
    if (path === `/products/${productId}`) return route.fulfill({ json: { product: fixtureProduct, content_kits: hasKit ? [fixtureKit] : [] } });
    if (path === `/products/${productId}/content-kit`) { kitInstructions = req.postDataJSON().instructions || ""; hasKit = true; return route.fulfill({ json: { content_kit: fixtureKit, created: true } }); }
    if (path === "/creator-content" && method === "GET") return route.fulfill({ json: status ? [production()] : [] });
    if (method === "DELETE" && path.startsWith("/creator-content/")) { status = ""; return route.fulfill({ json: { id: productionId, deleted: true } }); }
    if (path === "/creator-content" && method === "POST") { hasKit = true; status = req.postDataJSON().product_id ? "salvo" : "em_producao"; return route.fulfill({ json: production() }); }
    if (path === `/creator-content/${productionId}/content-kit`) { status = "em_producao"; return route.fulfill({ json: production() }); }
    if (path === `/creator-content/${productionId}`) { status = req.postDataJSON().status; return route.fulfill({ json: production() }); }
    if (path === "/assistant/searches" && method === "GET") {
      return route.fulfill({
        json: {
          items: savedSearches.map((item) => ({
            id: item.id,
            query: item.query,
            result_count: item.products.length,
            needs_clarification: item.needs_clarification,
            created_at: item.created_at,
            updated_at: item.updated_at,
          })),
        },
      });
    }
    if (path === "/assistant/searches" && method === "DELETE") {
      const deleted = savedSearches.length;
      savedSearches.length = 0;
      return route.fulfill({ json: { deleted } });
    }
    if (path.startsWith("/assistant/searches/")) {
      const id = path.slice("/assistant/searches/".length);
      const index = savedSearches.findIndex((item) => item.id === id);
      if (method === "DELETE") {
        if (index >= 0) savedSearches.splice(index, 1);
        return route.fulfill({ json: { id, deleted: index >= 0 } });
      }
      if (index < 0) return route.fulfill({ status: 404, json: { error: { code: "RESOURCE_NOT_FOUND", message: "Busca não encontrada." } } });
      const saved = savedSearches[index];
      return route.fulfill({ json: { ...saved, results: saved.products, result_count: saved.products.length, context_ids: saved.products.map((product) => (product as { id: string }).id) } });
    }
    if (path === "/assistant/products") {
      searchCalls++;
      lastSearchPayload = req.postDataJSON();
      const rememberSearch = (json: { message: string; products: Array<{ id: string } & Record<string, unknown>>; needs_clarification?: boolean }) => {
        const query = String(req.postDataJSON().message || "").trim();
        const now = new Date().toISOString();
        const existing = savedSearches.find((item) => item.query.toLocaleLowerCase("pt-BR") === query.toLocaleLowerCase("pt-BR"));
        if (existing) {
          Object.assign(existing, { message: json.message, products: json.products, needs_clarification: Boolean(json.needs_clarification), updated_at: now });
        } else {
          savedSearches.unshift({
            id: `search-${++searchSequence}`,
            query,
            message: json.message,
            products: json.products,
            needs_clarification: Boolean(json.needs_clarification),
            created_at: now,
            updated_at: now,
          });
        }
        return route.fulfill({ json });
      };
      if (options.failSearch && searchCalls === 1) return route.fulfill({ status: 503, json: { error: { message: "Tente novamente em instantes." } } });
      if (req.postDataJSON().message === "Olá") return route.fulfill({ json: { message: "O que você quer vender? Posso sugerir por preço, nicho ou facilidade de gravar.", products: [], needs_clarification: true } });
      if (req.postDataJSON().message === "Quero produtos fáceis de demonstrar em vídeo") return rememberSearch({ message: "Para sugerir algo fácil de gravar, diga um nicho ou produto. O catálogo não informa a facilidade de demonstração.", products: [], needs_clarification: true });
      if (options.comparison || options.sensitive) return rememberSearch({ message: "Encontrei 5 produtos para você.", products: options.sensitive ? [...comparisonProducts.slice(0, 4), { ...comparisonProducts[4], nome: "Camisola delicada", categoria: "Lingerie" }] : comparisonProducts });
      return rememberSearch({ message: "Encontrei uma oportunidade no catálogo.", products: [{ ...product, motivo: "Preço acessível · 125 vendidos" }] });
    }
    if (path === "/creators/onboarding") {
      if (onboardingFailures > 0) {
        onboardingFailures -= 1;
        return route.fulfill({ status: 503, json: { error: { message: "Não conseguimos salvar agora." } } });
      }
      const payload = req.postDataJSON() as Record<string, unknown>;
      onboardingPayloads.push(payload);
      onboarded = true;
      creator.objetivo = payload.objetivo;
      creator.estilos_conteudo = payload.estilos_conteudo;
      creator.temas_interesse = payload.temas_interesse;
      creator.voz_exemplo = payload.voz_exemplo;
      return route.fulfill({ json: creator });
    }
    if (path === "/billing/plans") return route.fulfill({ json: billingCatalog });
    if (path === "/billing/checkout") {
      checkoutPayloads.push(req.postDataJSON() as Record<string, unknown>);
      return route.fulfill({ json: { url: "http://127.0.0.1:3100/pagamento-teste" } });
    }
    if (path === "/account") return route.fulfill({ json: { nome: "Rafa", email: "creator@temtrend.test" } });
    return route.fulfill({ status: 404, json: { error: { message: `Unmocked: ${path}` } } });
  });
  return { mutations, getStatus: () => status, getKitInstructions: () => kitInstructions, getLastSearchPayload: () => lastSearchPayload, getCreator: () => creator, onboardingPayloads, checkoutPayloads };
}

async function contrastRatios(page: Page, pairs: Array<{ text: string; background?: string }>) {
  return page.evaluate((items) => {
    const parse = (value: string) => ((value.match(/\d+(?:\.\d+)?/g) || []).slice(0, 3).map(Number)) as [number, number, number];
    const channel = (value: number) => { const c = value / 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; };
    const luminance = ([r, g, b]: [number, number, number]) => .2126 * channel(r) + .7152 * channel(g) + .0722 * channel(b);
    return items.map(({ text, background }) => {
      const textElement = document.querySelector(text);
      const backgroundElement = background ? document.querySelector(background) : textElement;
      if (!textElement || !backgroundElement) return 0;
      const foreground = luminance(parse(getComputedStyle(textElement).color));
      const backdrop = luminance(parse(getComputedStyle(backgroundElement).backgroundColor));
      return (Math.max(foreground, backdrop) + .05) / (Math.min(foreground, backdrop) + .05);
    });
  }, pairs);
}

async function allSurfacesDark(page: Page, selectors: string[]) {
  return page.evaluate((items) => items.every((selector) => {
    const element = document.querySelector(selector);
    if (!element) return false;
    const [r, g, b] = ((getComputedStyle(element).backgroundColor.match(/\d+(?:\.\d+)?/g) || []).slice(0, 3).map(Number));
    return (r + g + b) / 3 < 80;
  }), selectors);
}

test("descoberta, kit e produção até publicação manual", async ({ page }, testInfo) => {
  const fixture = await setup(page);
  await page.goto("/descobrir");
  await expect(page.getByRole("heading", { name: "Encontre a próxima oportunidade." })).toBeVisible();
  await page.getByLabel("O que você quer vender?").fill("organizador de cozinha");
  await page.locator(".assistant-send-button").click();
  await expect(page.locator(".assistant-response .opportunity-card")).toHaveCount(1);
  // Depois de buscar, o composer desce e fica preso no rodapé da janela.
  await expect(page.locator(".discovery-hero")).toHaveCount(0);
  const dock = page.locator(".discovery-dock");
  await expect(dock).toBeVisible();
  const dockBottom = await dock.evaluate((element) => ({
    bottom: element.getBoundingClientRect().bottom,
    viewport: window.innerHeight,
  }));
  expect(dockBottom.viewport - dockBottom.bottom).toBeLessThanOrEqual(2);
  await expect(page.locator(".assistant-response")).toBeVisible();
  await expect(page.getByText(/Preço acessível/)).toHaveCount(0);
  await expect(page.locator(".assistant-response .opportunity-price dt")).toHaveText(["Preço", "Comissão estimada", "Vendas"]);
  await page.screenshot({ path: testInfo.outputPath("discover-desktop.png"), fullPage: true });
  await page.getByRole("button", { name: "Ver detalhes de Organizador de cozinha" }).click();
  await expect(page).toHaveURL(new RegExp(`/produtos/${productId}/kits/${kitId}$`));
  const recording = page.locator(".rw");
  expect(fixture.getStatus()).toBe("");
  await expect(recording.getByRole("heading", { name: "Organizador de cozinha" })).toBeVisible();
  await expect(recording.getByText("125 vendas no período")).toHaveCount(0);
  await expect(recording.locator(".rw-product-meta")).toContainText("Casa e cozinha · R$ 29,90");
  await expect(recording.getByRole("heading", { name: "Antes de gravar" })).toBeVisible();
  await expect(recording.getByText("Etapa 1 de 4 · Preparar")).toBeVisible();
  for (const item of ["Produto à mão", "Boa luz", "Fundo organizado", "Lente limpa"]) {
    await recording.locator(".rw-check").filter({ hasText: item }).click();
  }
  await expect(recording.getByText("Tudo pronto")).toBeVisible();
  await recording.getByRole("button", { name: "Começar a gravar" }).click();
  await expect(recording.getByRole("heading", { name: "Abertura" })).toBeVisible();
  await expect(recording.getByText(kit.hook)).toBeVisible();
  await recording.getByRole("button", { name: "Abertura gravada" }).click();
  await expect(recording.getByRole("heading", { name: "Cena 1" })).toBeVisible();
  await expect(recording.getByText("Mostre a bancada")).toBeVisible();
  await expect(recording.getByText("Olha esta ideia")).toBeVisible();
  await recording.getByRole("button", { name: "Cena gravada" }).click();
  await expect(recording.getByRole("heading", { name: "Cena 2" })).toBeVisible();
  await expect(recording.getByText("Se quiser garantir o seu, confira se ainda tem disponível no carrinho aqui embaixo")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("kit-desktop.png"), fullPage: true });
  await recording.getByRole("button", { name: "Marcar como gravado" }).click();
  await expect(page.getByText("Vídeo marcado como gravado. Próximo passo: publicar.")).toBeVisible();
  expect(fixture.getStatus()).toBe("gravado");
  await expect(recording.getByRole("button", { name: "Marcar como publicado" })).toBeVisible();
  await page.goto("/descobrir");
  await page.goto("/producao");
  await expect(page.locator(".production-card").filter({ hasText: product.nome })).toHaveCount(1);
  await expect(page.getByText("Comissão por venda")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver roteiro" })).toHaveCount(0);
});

test("Descobrir troca contexto, cria conteúdo e envia referência visual", async ({ page }, testInfo) => {
  const fixture = await setup(page);
  await page.goto("/descobrir");
  await expect(page.getByRole("heading", { name: "Encontre a próxima oportunidade." })).toBeVisible();
  await expect(page.getByRole("link", { name: "TemTrend, abrir dashboard" })).toHaveCount(0);
  await expect(page.locator(".assistant-context-hint")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("discover-studio-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath("discover-studio-mobile.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.goto("/descobrir?context=create");
  await expect(page.getByRole("heading", { name: "Sua ideia vira roteiro." })).toBeVisible();
  await page.getByLabel("Qual conteúdo você quer criar?").fill("organizador para cozinha");
  await page.getByRole("button", { name: "Escolher produto" }).click();
  await expect(page.locator(".assistant-response .opportunity-card")).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath("discover-results-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { (document.activeElement as HTMLElement | null)?.blur(); window.scrollTo(0, 0); });
  const mobileLayout = await page.evaluate(() => {
    const composer = document.querySelector(".assistant-composer")!.getBoundingClientRect();
    const send = document.querySelector(".assistant-send-button")!.getBoundingClientRect();
    const image = document.querySelector(".opportunity-card .product-image-wrap")!.getBoundingClientRect();
    return { sendFits: send.right <= composer.right && send.left >= composer.left, imageHeight: image.height, overflows: document.documentElement.scrollWidth > innerWidth };
  });
  expect(mobileLayout.sendFits).toBe(true);
  expect(mobileLayout.imageHeight).toBeLessThanOrEqual(200);
  expect(mobileLayout.overflows).toBe(false);
  await page.screenshot({ path: testInfo.outputPath("discover-results-mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  expect(String(fixture.getLastSearchPayload()?.message)).toContain("Quero criar conteúdo");
  await page.getByRole("button", { name: /^Gravar conteúdo para Organizador de cozinha$/ }).click();
  await expect(page).toHaveURL(new RegExp(`/produtos/${productId}/kits/${kitId}$`));
  await page.goto("/descobrir");

  await page.getByRole("tab", { name: "Planejar a semana" }).click();
  await page.getByLabel("Qual é o foco desta semana?").fill("casa e organização");
  await page.getByRole("button", { name: "Preparar minha semana" }).click();
  expect(String(fixture.getLastSearchPayload()?.message)).toContain("Planeje sete dias");

  await page.getByRole("tab", { name: "Descobrir produtos" }).click();
  await page.locator(".assistant-image-input").setInputFiles("tests/fixtures/discover-renaissance-studio.png");
  await expect(page.getByLabel("Imagem anexada: discover-renaissance-studio.png")).toBeVisible();
  await page.locator(".assistant-send-button").click();
  await expect(page.locator(".assistant-response .opportunity-card")).toHaveCount(1);
  expect((fixture.getLastSearchPayload()?.image as { mime_type: string }).mime_type).toBe("image/jpeg");
  // O composer esvazia ao enviar: o anexo vira a mensagem do chat.
  await expect(page.getByLabel("Imagem anexada: discover-renaissance-studio.png")).toHaveCount(0);

});

test("nova busca limpa a conversa e volta à tela inicial", async ({ page }, testInfo) => {
  await setup(page);
  await page.goto("/descobrir");

  await page.getByLabel("O que você quer vender?").fill("organizador de cozinha");
  await page.locator(".assistant-send-button").click();
  await expect(page.locator(".assistant-response .opportunity-card")).toHaveCount(1);

  // "Nova busca" limpa o chat atual e devolve o compositor vazio.
  await page.getByRole("button", { name: "Nova busca" }).evaluate((button) => (button as HTMLElement).click());
  await expect(page.getByRole("heading", { name: "Encontre a próxima oportunidade." })).toBeVisible();
  await expect(page.getByLabel("O que você quer vender?")).toHaveValue("");
  await expect(page.locator(".assistant-response .opportunity-card")).toHaveCount(0);
  await expect(page).toHaveURL(/\/descobrir$/);
  await page.screenshot({ path: testInfo.outputPath("new-search-desktop.png") });

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("new-search-mobile.png") });
});

test("descobrir abre e notificações funcionam como pop-up", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await setup(page, { saved: true });
  await page.goto("/descobrir");
  await expect(page.getByRole("heading", { name: /Encontre|Sua próxima|oportunidade/i }).first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("discover-desktop.png"), fullPage: true });

  const bell = page.getByRole("button", { name: /Abrir notificações/ });
  await expect(bell).toContainText("1");
  await bell.click();
  const panel = page.getByRole("dialog", { name: "Notificações" });
  await expect(panel).toBeVisible();
  await expect(panel.getByText("Roteiro esperando você")).toBeVisible();
  await expect(panel.getByRole("link", { name: /Abrir roteiro/ })).toBeVisible();
  await panel.getByRole("button", { name: "Marcar como lidas" }).click();
  await expect(page.getByRole("button", { name: "Abrir notificações", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  const mobileBell = page.getByRole("button", { name: /Abrir notificações/ });
  await expect(mobileBell).toBeVisible();
  await mobileBell.click();
  await expect(panel).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("navegação interna preserva a casca e não pisca boot", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await setup(page);
  await page.goto("/descobrir");

  const topbar = page.locator("header.topbar");
  await topbar.evaluate((element) => element.setAttribute("data-nav-persist", "1"));
  await page.evaluate(() => {
    const state = window as unknown as { __ttKept?: string; __ttBootFlashes?: number };
    state.__ttKept = "yes";
    state.__ttBootFlashes = 0;
    const observer = new MutationObserver(() => {
      if (document.querySelector(".app-boot")) {
        state.__ttBootFlashes = (state.__ttBootFlashes || 0) + 1;
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });

  const sidebar = page.locator(".tt-app-sidebar");
  await sidebar.getByRole("link", { name: "Meus conteúdos", exact: true }).click();
  await expect(page).toHaveURL(/\/conteudos$/);
  await expect(page.locator("header.topbar")).toHaveAttribute("data-nav-persist", "1");
  await expect(page.getByRole("heading", { level: 1, name: "Meus conteúdos" })).toBeVisible();

  // "Novo conteúdo" abre o Descobrir em uma conversa nova.
  await page.getByRole("link", { name: "+ Novo conteúdo" }).click();
  await expect(page).toHaveURL(/\/descobrir\?nova=\d+$/);
  await expect(page.locator("#assistant-input")).toBeVisible();
  await expect(page.locator("header.topbar")).toHaveAttribute("data-nav-persist", "1");

  await sidebar.getByRole("link", { name: "Descobrir", exact: true }).click();
  await expect(page).toHaveURL(/\/descobrir(?:\?nova=\d+)?$/);
  await expect(page.locator("header.topbar")).toHaveAttribute("data-nav-persist", "1");

  await page.getByLabel("Minha conta e sair").click();
  await page.locator(".user-menu--sidebar .user-menu-panel").getByRole("link", { name: "Minha conta" }).click();
  await expect(page).toHaveURL(/\/conta$/);
  await expect(page.locator("header.topbar")).toHaveAttribute("data-nav-persist", "1");

  const state = await page.evaluate(() => {
    const value = window as unknown as { __ttKept?: string; __ttBootFlashes?: number };
    return { kept: value.__ttKept, bootFlashes: value.__ttBootFlashes };
  });
  expect(state.kept).toBe("yes");
  expect(state.bootFlashes).toBe(0);
});

test("busca enviada da landing fica pronta na descoberta", async ({ page }) => {
  await setup(page);
  await page.goto("/descobrir?search=produto%20de%20beleza");
  await expect(page.getByLabel("O que você quer vender?")).toHaveValue("produto de beleza");
});

test("busca pendente sobrevive ao retorno do login social", async ({ page }) => {
  await setup(page);
  await page.addInitScript(() => sessionStorage.setItem("temtrend_pending_search", "achadinho para casa"));
  await page.goto("/descobrir");
  await expect(page.getByLabel("O que você quer vender?")).toHaveValue("achadinho para casa");
});

test("modo de gravação abre direto no roteiro em etapas", async ({ page }) => {
  await setup(page, { saved: true });
  await page.goto("/conteudos");
  await page.locator(".ct-row").filter({ hasText: product.nome }).getByRole("button", { name: "Gravar", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/produtos/${productId}/kits/${kitId}$`));
  const wizard = page.locator(".rw");
  await expect(wizard.getByRole("heading", { name: "Antes de gravar" })).toBeVisible();
  await expect(wizard.getByText("Etapa 1 de 4 · Preparar")).toBeVisible();
  await expect(wizard.getByRole("button", { name: "Começar a gravar" })).toBeVisible();
});

test("salvo não avança ao abrir o kit; retomada no celular", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const fixture = await setup(page, { saved: true });
  await page.goto("/descobrir");
  await expect(page.getByRole("heading", { name: /Encontre|Sua próxima|oportunidade/i }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("discover-mobile.png"), fullPage: true });
  // A navegação agora é Descobrir / Meus conteúdos / Resultados: os produtos
  // salvos continuam acessíveis pela rota própria.
  await page.goto("/producao");
  await expect(page.getByText("Comissão por venda")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver roteiro" })).toHaveCount(0);
  await page.locator(".production-card").first().getByRole("link", { name: "Gravar", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/produtos/${productId}$`));
  await page.getByRole("link", { name: "Ver roteiro" }).click();
  const wizard = page.locator(".rw");
  await expect(wizard.getByRole("heading", { name: "Antes de gravar" })).toBeVisible();
  await expect(page.locator(".kit-document, .kit-actions")).toHaveCount(0);
  expect(fixture.mutations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("kit-mobile.png"), fullPage: true });
  await expect(wizard.getByText("Etapa 1 de 4 · Preparar")).toBeVisible();
  await wizard.locator(".rw-check").filter({ hasText: "Boa luz" }).click();
  await wizard.getByRole("button", { name: "Começar a gravar" }).click();
  await wizard.getByRole("button", { name: "Abertura gravada" }).click();
  await wizard.getByRole("button", { name: "Cena gravada" }).click();
  await expect(wizard.getByRole("button", { name: "Marcar como gravado" })).toBeVisible();
  await wizard.getByRole("button", { name: "Marcar como gravado" }).click();
  await expect(page.getByText("Vídeo marcado como gravado. Próximo passo: publicar.")).toBeVisible();
  expect(fixture.getStatus()).toBe("gravado");
});

test("busca preserva texto após erro e atalho busca produtos reais", async ({ page }) => {
  await setup(page, { failSearch: true });
  await page.goto("/descobrir");
  await page.getByLabel("O que você quer vender?").fill("Produtos para casa");
  await page.locator(".assistant-send-button").click();
  await expect(page.getByRole("button", { name: "Tentar novamente", exact: true })).toBeVisible();
  // O texto enviado vira balão da conversa; o campo limpa para a próxima mensagem.
  await expect(page.getByLabel("O que você quer vender?")).toHaveValue("");
  await page.getByRole("button", { name: "Tentar novamente", exact: true }).click();
  await expect(page.getByRole("heading", { name: product.nome })).toBeVisible();
  await page.getByRole("button", { name: "Nova busca" }).click({ force: true });
  await page.getByRole("tab", { name: "Não sei o que vender" }).click();
  await page.locator(".assistant-send-button").click();
  await expect(page.getByRole("heading", { name: product.nome })).toBeVisible();
});

test("atalhos de preço e nicho abrem pop-up dentro da caixa e buscam", async ({ page }) => {
  const fixture = await setup(page);
  await page.goto("/descobrir");
  await expect(page.getByRole("heading", { name: "Encontre a próxima oportunidade." })).toBeVisible();

  await page.getByRole("button", { name: "Abrir opções de preço" }).click();
  await expect(page.getByRole("menu", { name: "Opções de preço" })).toBeVisible();
  await page.getByRole("menuitemradio", { name: "Até R$ 50" }).click();
  await expect(page.getByRole("heading", { name: product.nome })).toBeVisible();
  expect(String(fixture.getLastSearchPayload()?.message)).toContain("preço de até 50 reais");

  await page.getByRole("button", { name: "Nova busca" }).click({ force: true });
  await page.getByRole("button", { name: "Abrir opções de nicho" }).click();
  await expect(page.getByRole("menu", { name: "Opções de nicho" })).toBeVisible();
  await page.getByRole("menuitemradio", { name: "Beleza" }).click();
  await expect(page.getByRole("heading", { name: product.nome })).toBeVisible();
  expect(String(fixture.getLastSearchPayload()?.message)).toContain("produtos de beleza");
});

test("resultados exibem cinco produtos comparáveis e ações diretas", async ({ page }, testInfo) => {
  const fixture = await setup(page, { comparison: true });
  await page.goto("/descobrir");
  await page.getByLabel("O que você quer vender?").fill("Produtos para casa");
  await page.locator(".assistant-send-button").click();
  const cards = page.locator(".assistant-response .opportunity-card");
  await expect(cards).toHaveCount(5);
  // Grade de resultados: colunas iguais, todos os produtos alinhados ao grid.
  const grid = page.locator(".assistant-response .product-grid");
  // Espera a animação de entrada terminar para medir a largura final.
  await grid.evaluate((node) =>
    Promise.all(node.getAnimations({ subtree: true }).map((animation) => animation.finished)),
  );
  const gridWidth = await grid.evaluate((node) => node.getBoundingClientRect().width);
  const columnWidths = await grid.evaluate((node) =>
    getComputedStyle(node).gridTemplateColumns.split(" ").map(parseFloat),
  );
  expect(columnWidths.length).toBeGreaterThanOrEqual(1);
  expect(new Set(columnWidths.map((width) => Math.round(width))).size).toBe(1);
  const widths = await cards.evaluateAll((nodes) =>
    nodes.map((node) => node.getBoundingClientRect().width),
  );
  expect(widths).toHaveLength(5);
  for (const width of widths) {
    expect(width).toBeGreaterThan(0);
    expect(width).toBeLessThanOrEqual(gridWidth + 2);
  }
  await expect(cards.first().getByRole("heading")).toHaveText("Kit organizador de banheiro");
  await expect(page.getByRole("button", { name: /Mostrar mais/ })).toHaveCount(0);
  for (const card of await cards.all()) {
    await expect(card.locator(".opportunity-price dt")).toHaveText(["Preço", "Comissão estimada", "Vendas"]);
    await expect(card.getByRole("button", { name: /^Salvar / })).toBeVisible();
    await expect(card.getByRole("button", { name: /^Gravar conteúdo para/ })).toBeVisible();
  }
  await expect(cards.nth(4).getByText("Maior comissão estimada")).toBeVisible();
  await expect(cards.nth(2).getByText("Maior comissão estimada")).toHaveCount(0);
  await cards.first().getByRole("button", { name: /^Comparar / }).click();
  await cards.nth(1).getByRole("button", { name: /^Comparar / }).click();
  await expect(page.getByLabel("Comparação de produtos")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("five-comparable-products.png"), fullPage: true });

  await cards.nth(2).getByRole("button", { name: "Salvar Organizador de cozinha" }).click();
  await expect(cards.nth(2).getByRole("button", { name: "Remover Organizador de cozinha dos salvos" })).toBeVisible();
  await expect(page).toHaveURL(/\/descobrir$/);
  expect(fixture.mutations).toContain("POST /creator-content");

  await cards.nth(2).getByRole("button", { name: /^Gravar conte.do para Organizador de cozinha$/ }).click();
  await expect(page).toHaveURL(new RegExp(`/produtos/${productId}/kits/${kitId}$`));
  await page.goto("/descobrir");
  await page.goto("/producao");
  await expect(page.locator(".production-card").filter({ hasText: product.nome })).toHaveCount(1);
  await expect(page.getByText("Comissão por venda")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver roteiro" })).toHaveCount(0);
});

test("saudação pede uma direção antes de sugerir produtos", async ({ page }) => {
  await setup(page);
  await page.goto("/descobrir");
  await page.getByLabel("O que você quer vender?").fill("Olá");
  await page.locator(".assistant-send-button").click();
  await expect(page.getByText(/O que você quer vender\? Posso sugerir/)).toBeVisible();
  await expect(page.locator(".assistant-response .opportunity-card")).toHaveCount(0);
  await expect(page.getByText("Nenhum produto encontrado.")).toHaveCount(0);
});

test("resultados e ações cabem na largura do celular", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, { comparison: true });
  await page.goto("/descobrir");
  await page.getByLabel("O que você quer vender?").fill("Produtos para casa");
  await page.locator(".assistant-send-button").click();
  const cards = page.locator(".assistant-response .opportunity-card");
  await expect(cards).toHaveCount(5);
  // Espera a revelação progressiva terminar: medir no meio da animação encolhe os alvos.
  await cards.evaluateAll((nodes) =>
    Promise.all(nodes.flatMap((node) =>
      node.getAnimations({ subtree: true }).map((animation) => animation.finished),
    )),
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(cards.last().getByRole("button", { name: "Gravar conteúdo para Luminária para vídeo" })).toBeVisible();
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    const layout = await cards.evaluateAll((elements) => elements.map((card) => {
      const bounds = card.getBoundingClientRect();
      const primary = Array.from(card.querySelectorAll<HTMLElement>(".product-actions button"));
      const tools = Array.from(card.querySelectorAll<HTMLElement>(".opportunity-card-tools button"));
      const buttons = [...primary, ...tools];
      return {
        primary: primary.length,
        tools: tools.length,
        all: buttons.length,
        inside: buttons.every((button) => {
          const rect = button.getBoundingClientRect();
          return rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1 && rect.width > 0;
        }),
        touchable: primary.every((button) => button.getBoundingClientRect().height >= 44),
        accessibleTools: tools.every((button) => button.getBoundingClientRect().width >= 32
          && button.getBoundingClientRect().height >= 32
          && Boolean(button.getAttribute("aria-label"))),
      };
    }));
    // Ações: gravar (principal) + comparar/salvar (ferramentas).
    expect(layout.every(({ primary, tools, all, inside, touchable, accessibleTools }) =>
      primary === 3 && tools === 2 && all === 5 && inside && touchable && accessibleTools)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath("five-comparable-products-mobile.png"), fullPage: true });
});

test("categoria sensível recebe aviso e pode ser ocultada sem falsear a contagem", async ({ page }) => {
  await setup(page, { sensitive: true });
  await page.goto("/descobrir");
  await page.getByLabel("O que você quer vender?").fill("produtos variados");
  await page.locator(".assistant-send-button").click();
  await expect(page.locator(".assistant-response .opportunity-card")).toHaveCount(5);
  await expect(page.getByText("Pode ter restrição de anúncio ou criativo no TikTok.")).toBeVisible();
});

test("roteiro conduz a gravação por etapas no celular", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, { saved: true });
  await page.goto(`/produtos/${productId}/kits/${kitId}`);
  const wizard = page.locator(".rw");
  await expect(wizard.getByRole("heading", { name: "Organizador de cozinha" })).toBeVisible();
  await expect(wizard.getByRole("heading", { name: "Antes de gravar" })).toBeVisible();
  await expect(wizard.getByText("Etapa 1 de 4 · Preparar")).toBeVisible();
  for (const item of ["Produto à mão", "Boa luz", "Fundo organizado", "Lente limpa"]) {
    await expect(wizard.getByRole("checkbox", { name: item })).toBeVisible();
  }
  // O CTA principal fica discreto até a preparação ser marcada.
  await expect(wizard.getByRole("button", { name: "Começar a gravar" })).toHaveClass(/is-quiet/);
  await wizard.locator(".rw-check").filter({ hasText: "Boa luz" }).click();
  await expect(wizard.getByRole("checkbox", { name: "Boa luz" })).toBeChecked();
  await expect(wizard.getByText("1 de 4 prontos")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await wizard.getByRole("button", { name: "Começar a gravar" }).click();
  await expect(wizard.getByRole("heading", { name: "Abertura" })).toBeVisible();
  await expect(wizard.getByText(kit.hook)).toBeVisible();
  await wizard.getByRole("button", { name: "Abertura gravada" }).click();
  await expect(wizard.getByRole("heading", { name: "Cena 1" })).toBeVisible();
  await expect(wizard.getByText("Mostre a bancada")).toBeVisible();
  await expect(wizard.getByText("Olha esta ideia")).toBeVisible();
  await expect(wizard.getByText("Corte para o produto")).toBeVisible();
  await wizard.getByRole("button", { name: "Cena gravada" }).click();
  await expect(wizard.getByRole("heading", { name: "Cena 2" })).toBeVisible();
  await expect(wizard.getByText("Se quiser garantir o seu, confira se ainda tem disponível no carrinho aqui embaixo")).toBeVisible();
  await expect(wizard.getByRole("button", { name: "Marcar como gravado" })).toBeVisible();
  // Menu: roteiro completo e volta ao guia sem perder a etapa.
  await wizard.getByRole("button", { name: "Mais opções do roteiro" }).click();
  await wizard.getByRole("menuitem", { name: "Ver roteiro completo" }).click();
  await expect(wizard.getByText("Roteiro", { exact: true })).toBeVisible();
  await wizard.getByRole("button", { name: /Voltar ao guia/ }).click();
  await expect(wizard.getByRole("heading", { name: "Cena 2" })).toBeVisible();
  // O plano lateral também navega entre etapas.
  await wizard.locator(".rw-plan").getByRole("button", { name: /Abertura/ }).click();
  await expect(wizard.getByRole("heading", { name: "Abertura" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("guided-kit-mobile.png"), fullPage: true });
  await wizard.locator(".rw-plan").getByRole("button", { name: /Cena 2/ }).click();
  await wizard.getByRole("button", { name: "Marcar como gravado" }).click();
  await expect(page.getByText("Vídeo marcado como gravado. Próximo passo: publicar.")).toBeVisible();
});

test("roteiro no modo noturno mantém produto, etapas e guia legíveis", async ({ page }, testInfo) => {
  await page.addInitScript(() => { try { localStorage.setItem("temtrend_theme", "dark"); } catch {} });
  await setup(page, { saved: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/produtos/${productId}/kits/${kitId}`);
  const wizard = page.locator(".rw");
  await expect(wizard.getByRole("heading", { name: "Organizador de cozinha" })).toBeVisible();
  await expect(wizard.locator(".rw-product-meta")).toContainText("Casa e cozinha · R$ 29,90");
  await expect(wizard.getByText("Etapa 1 de 4 · Preparar")).toBeVisible();
  expect(await allSurfacesDark(page, [".rw-main", ".rw-plan", ".rw-tip", ".rw-product-thumb"])).toBe(true);
  const baseRatios = await contrastRatios(page, [
    { text: ".rw-kicker", background: ".rw-main" },
    { text: ".rw-main h2", background: ".rw-main" },
    { text: ".rw-desc", background: ".rw-main" },
    { text: ".rw-check-label", background: ".rw-main" },
    { text: ".rw-tip", background: ".rw-main" },
    { text: ".rw-next", background: ".rw-main" },
    { text: ".rw-plan h3", background: ".rw-plan" },
    { text: ".rw-plan small", background: ".rw-plan" },
    { text: ".rw-product-meta", background: ".rw-main" },
  ]);
  expect(baseRatios.filter((ratio) => ratio < 4.5)).toEqual([]);

  // O menu de opções e a etapa de abertura seguem legíveis no escuro.
  await wizard.getByRole("button", { name: "Mais opções do roteiro" }).click();
  await expect(wizard.getByRole("menu")).toBeVisible();
  expect(await allSurfacesDark(page, [".rw-menu"])).toBe(true);
  const menuRatios = await contrastRatios(page, [
    { text: ".rw-menu button", background: ".rw-menu" },
    { text: ".rw-menu a", background: ".rw-menu" },
  ]);
  expect(menuRatios.filter((ratio) => ratio < 4.5)).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("roteiro-dark-menu.png") });

  await wizard.locator(".rw-plan").getByRole("button", { name: /Abertura/ }).click();
  await expect(wizard.getByRole("heading", { name: "Abertura" })).toBeVisible();
  expect(await allSurfacesDark(page, [".rw-quote", ".rw-main", ".rw-plan"])).toBe(true);
  const hookRatios = await contrastRatios(page, [
    { text: ".rw-main h2", background: ".rw-main" },
    { text: ".rw-quote", background: ".rw-main" },
    { text: ".rw-plan li.is-done small", background: ".rw-plan" },
  ]);
  expect(hookRatios.filter((ratio) => ratio < 4.5)).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("roteiro-dark.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(wizard.getByRole("heading", { name: "Organizador de cozinha" })).toBeVisible();
  expect(await allSurfacesDark(page, [".rw-main", ".rw-plan", ".rw-tip", ".rw-product-thumb"])).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("roteiro-dark-mobile.png"), fullPage: true });

  await page.route(`http://localhost:3333/products/${productId}`, (route) => route.fulfill({ json: { product: { ...product, imagem_url: "" }, content_kits: [kit] } }));
  await page.reload();
  const fallback = page.locator(".rw-product-thumb .product-image-fallback");
  await expect(fallback).toBeVisible();
  expect(await allSurfacesDark(page, [".rw-product-thumb .product-image-fallback"])).toBe(true);
  const [fallbackRatio] = await contrastRatios(page, [
    { text: ".rw-product-thumb .product-image-fallback span", background: ".rw-product-thumb .product-image-fallback span" },
  ]);
  expect(fallbackRatio).toBeGreaterThanOrEqual(4.5);
  await page.screenshot({ path: testInfo.outputPath("roteiro-dark-fallback.png"), fullPage: true });
});

test("detalhes, guia e produção mantêm o nome completo e a largura em três telas", async ({ page }, testInfo) => {
  const longName = "Kit 2 Colares Prata e Ouro com Coração e Correntes Delicadas para Compor Looks";
  await setup(page, { saved: true, productOverride: { nome: longName, imagem_url: "" } });
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/descobrir");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.goto(`/produtos/${productId}`);
    await expect(page.getByRole("heading", { name: longName, exact: true })).toBeVisible();
    if (width === 390) expect(await page.getByRole("heading", { name: longName, exact: true }).evaluate((element) => element.getBoundingClientRect().height / parseFloat(getComputedStyle(element).lineHeight))).toBeLessThanOrEqual(3.15);
    await expect(page.getByText("Imagem do produto")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Ver roteiro" })).toBeVisible();
    if (width === 390) await page.screenshot({ path: testInfo.outputPath("product-detail-mobile.png"), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.goto(`/produtos/${productId}/kits/${kitId}`);
    await expect(page.locator(".rw-product h1")).toHaveAttribute("title", longName);
    await expect(page.locator(".rw-product-full")).toHaveText(longName);
    await expect(page.locator(".rw-product-meta")).toContainText("Casa e cozinha · R$ 29,90");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width > 760) {
      await expect(page.locator(".rw-plan").getByRole("heading", { name: "Seu plano" })).toBeVisible();
    }
    await page.goto("/producao");
    await expect(page.getByRole("heading", { name: longName, exact: true })).toBeVisible();
    await expect(page.getByText("Imagem do produto")).toHaveCount(0);
    if (width === 390) await page.screenshot({ path: testInfo.outputPath("production-mobile.png"), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("roteiro antigo com título cortado mostra o nome completo do produto", async ({ page }) => {
  const completeName = "KIT 2 PCS Faca de Açougue Profissional Inox";
  await setup(page, { saved: true, productOverride: { nome: completeName }, kitOverride: { titulo: "KIT 2 PCS Faca de" } });
  await page.goto(`/produtos/${productId}`);
  await expect(page.locator(".kit-card h3")).toHaveText(completeName);
  await page.goto(`/produtos/${productId}/kits/${kitId}`);
  await expect(page.locator(".rw-product h1")).toHaveAttribute("title", completeName);
  await expect(page.locator(".rw-product-full")).toHaveText(completeName);
  await page.goto("/producao");
  await expect(page.locator(".production-kit-name")).toHaveCount(0);
});

test("conta mostra ações secundárias e estado de erro recuperável", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page.goto("/conta");
  await expect(page.getByRole("heading", { name: /Minha conta/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Atualizar senha" })).toHaveClass(/ghost/);
  await expect(page.getByRole("heading", { name: "Sua voz" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Preferências de conteúdo" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Salvar minha voz" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Dados atualizados ✓" })).toHaveCount(0);
  const cardTitles = await page.locator(".acct-grid .acct-card h2").allTextContents();
  expect(cardTitles).toEqual(["Informações do perfil", "Segurança"]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("account-settings-mobile.png"), fullPage: true });

  await page.getByRole("button", { name: "Excluir minha conta" }).click();
  const deleteDialog = page.getByRole("dialog");
  await expect(deleteDialog.getByRole("button", { name: "Confirmar exclusão" })).toBeDisabled();
  await deleteDialog.getByLabel("Digite seu email para confirmar").fill("creator@temtrend.test");
  await expect(deleteDialog.getByRole("button", { name: "Confirmar exclusão" })).toBeEnabled();
  await deleteDialog.getByRole("button", { name: "Cancelar" }).click();

  const failAccount = (route: import("@playwright/test").Route) => route.fulfill({ status: 503, json: { error: { message: "Indisponível" } } });
  await page.route("http://localhost:3333/account", failAccount);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Não conseguimos carregar sua conta." })).toBeVisible();
  await page.unroute("http://localhost:3333/account", failAccount);
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.getByRole("heading", { name: "Informações do perfil" })).toBeVisible();
});

test("produto sem kit mostra prévia compacta e uma ação principal", async ({ page }) => {
  const longName = "Organizador Modular de Cozinha com Divisórias Ajustáveis para Bancadas Pequenas";
  await setup(page, { productOverride: { nome: longName, imagem_url: "" } });
  await page.goto(`/produtos/${productId}`);
  await expect(page.getByRole("heading", { name: longName, exact: true })).toBeVisible();
  await expect(page.locator(".kit-empty-preview span")).toHaveText(["Hook", "5 cenas", "Legenda", "Hashtags", "CTA"]);
  await expect(page.getByRole("button", { name: "Gerar roteiro" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Salvar produto" })).toBeVisible();
  await expect(page.locator("#product-detail .primary")).toHaveCount(1);
  await expect(page.getByText("Use os dados confirmados do produto para gerar seu roteiro.")).toHaveCount(0);
});

test("criação de conteúdo cabe no celular sem rolagem lateral", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page.goto(`/produtos/${productId}`);
  await page.getByRole("button", { name: "Gerar roteiro", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Gere seu roteiro." })).toBeVisible();
  await expect(dialog.getByText("Produto do roteiro")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Gerar roteiro" })).toBeInViewport();
  expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("create-content-mobile.png") });
});

test("creator remove um produto da produção com confirmação", async ({ page }) => {
  const fixture = await setup(page, { saved: true });
  await page.goto("/producao");
  await expect(page.locator(".production-card:not(.production-skeleton)")).toHaveCount(1);

  await page.getByRole("button", { name: /Remover Organizador de cozinha dos produtos selecionados/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Remover dos selecionados?" })).toBeVisible();
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator(".production-card:not(.production-skeleton)")).toHaveCount(1);

  await page.getByRole("button", { name: /Remover Organizador de cozinha dos produtos selecionados/ }).click();
  await dialog.getByRole("button", { name: "Remover produto" }).click();
  await expect(page.locator(".production-card:not(.production-skeleton)")).toHaveCount(0);
  await expect(page.getByText("Produto removido dos selecionados.")).toBeVisible();
  expect(fixture.mutations).toContain(`DELETE /creator-content/${productionId}`);
});

test("menu da conta fica na sidebar como pop-up", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await setup(page);
  await page.goto("/descobrir");
  const trigger = page.getByLabel("Minha conta e sair");
  await expect(trigger).toBeVisible();
  const panel = page.locator(".user-menu--sidebar .user-menu-panel");
  await expect(panel).toBeHidden();
  await trigger.click();
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("link", { name: "Minha conta" })).toBeVisible();
  await expect(panel.getByRole("link", { name: "Planos e assinatura" })).toBeVisible();
  await expect(panel.getByRole("link", { name: "Preferências" })).toBeVisible();
  await expect(panel.getByRole("link", { name: "Suporte" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Sair" })).toBeVisible();
  // O pop-up abre acima do gatilho, que continua visível para fechar no mesmo lugar.
  const triggerBox = await trigger.boundingBox();
  const panelBox = await panel.boundingBox();
  expect(triggerBox).not.toBeNull();
  expect(panelBox).not.toBeNull();
  expect(panelBox!.y + panelBox!.height).toBeLessThanOrEqual(triggerBox!.y);
  await trigger.click();
  await expect(panel).toBeHidden();
});

test("produto salvo pode ser removido direto da busca", async ({ page }) => {
  const fixture = await setup(page, { saved: true });
  await page.goto("/descobrir");
  await page.getByLabel("O que você quer vender?").fill("organizador");
  await page.locator(".assistant-send-button").click();
  const card = page.locator(".assistant-response .opportunity-card").first();
  const remove = card.getByRole("button", { name: /Remover Organizador de cozinha dos salvos/ });
  await expect(remove).toBeVisible();
  await remove.click();
  await expect(page.getByText("Produto removido dos salvos.")).toBeVisible();
  await expect(card.getByRole("button", { name: /^Salvar Organizador de cozinha/ })).toBeVisible();
  expect(fixture.mutations).toContain(`DELETE /creator-content/${productionId}`);
});

test("produtos selecionados exibe dados comerciais sem ações de roteiro", async ({ page }) => {
  await setup(page);
  const states = [
    { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", status: "publicado", nome: "Produto publicado", updated: "2026-10-11T12:00:00Z" },
    { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", status: "salvo", nome: "Produto salvo", updated: "2026-10-09T12:00:00Z" },
    { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", status: "em_producao", nome: "Produto em gravação", updated: "2026-10-08T12:00:00Z" },
    { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", status: "gravado", nome: "Produto gravado", updated: "2026-10-10T12:00:00Z" },
  ];
  await page.route("http://localhost:3333/creator-content?*", (route) => route.fulfill({ json: states.map((item, index) => ({ id: item.id, creator_id: userId, product_id: item.id, content_kit_id: item.status === "salvo" ? null : kitId, status: item.status, products: { ...product, id: item.id, nome: item.nome, imagem_url: "", preco_min_brl: 20 + index * 10, comissao_percentual: 10 + index * 5, unidades_vendidas_total: 100 + index * 100 }, content_kits: item.status === "salvo" ? null : kit, atualizado_em: item.updated })) }));
  await page.goto("/producao");
  const cards = page.locator(".production-card:not(.production-skeleton)");
  await expect(cards).toHaveCount(4);
  await expect(cards.first().getByRole("heading", { name: "Produto publicado" })).toBeVisible();
  await expect(cards.first().getByText("Comissão por venda")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver roteiro" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Publicar" })).toHaveCount(0);
  // Cada item abre a gravação, sem ação de publicar direto da lista.
  for (const card of await cards.all()) {
    await expect(card.getByRole("link", { name: "Gravar", exact: true })).toBeVisible();
  }
});

test("onboarding em três etapas e menu acessível", async ({ page }, testInfo) => {
  const fixture = await setup(page, { onboarding: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/descobrir");
  await page.getByRole("radio", { name: /Quero começar a vender/ }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: testInfo.outputPath("onboarding-interests-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "Unboxing", exact: true }).click();
  await page.getByRole("button", { name: "Casa", exact: true }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: testInfo.outputPath("onboarding-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.locator("#onboarding-form").getByRole("heading", { name: "Escolha como começar.", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Assinar o Pro" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuar gratuitamente" })).toBeVisible();
  await page.waitForTimeout(600);
  await page.screenshot({ path: testInfo.outputPath("onboarding-plan-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "Continuar gratuitamente" }).click();
  await expect(page.getByRole("heading", { name: "Tudo pronto para começar!" })).toBeVisible();
  expect(fixture.onboardingPayloads.at(-1)).toMatchObject({
    objetivo: "comecar_vender",
    estilos_conteudo: ["Unboxing"],
    temas_interesse: ["Casa"],
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: testInfo.outputPath("onboarding-activated-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "Encontrar meu primeiro produto" }).click();
  await expect(page).toHaveURL(/\/descobrir$/);
  await expect(page.getByRole("heading", { name: "Encontre seu primeiro produto." })).toBeVisible();
  await expect(page.getByLabel("O que você quer vender?")).toHaveValue("Casa");
  await page.getByLabel("Abrir menu da conta").click();
  await expect(page.getByRole("link", { name: "Minha conta", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("link", { name: "Minha conta", exact: true })).toBeHidden();
  await page.getByLabel("Abrir menu da conta").click();
  await page.screenshot({ path: testInfo.outputPath("account-menu-mobile.png") });
  await expect(page.getByRole("link", { name: "Preferências", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Preferências", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ajuste como a IA responde" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Seu objetivo agora" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("account-mobile.png"), fullPage: true });
});

test("onboarding valida objetivo obrigatório e permite limpar a escolha", async ({ page }) => {
  await setup(page, { onboarding: true });
  await page.goto("/descobrir");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.locator("#onboarding-objetivo-error")).toContainText("Escolha uma opção para continuar.");
  await expect(page.getByRole("heading", { name: "Qual é o seu objetivo agora?" })).toBeVisible();

  const objetivo = page.getByRole("radio", { name: /Quero começar a vender/ });
  await objetivo.click();
  await expect(objetivo).toHaveAttribute("aria-checked", "true");
  await objetivo.click();
  await expect(objetivo).toHaveAttribute("aria-checked", "false");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.locator("#onboarding-objetivo-error")).toContainText("Escolha uma opção para continuar.");

  await objetivo.click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.locator("#onboarding-form").getByRole("heading", { name: "O que você vende define o seu conteúdo." })).toBeVisible();
});

test("onboarding limita temas, abre o nicho de Outros e salva as escolhas", async ({ page }) => {
  const fixture = await setup(page, { onboarding: true });
  await page.goto("/descobrir");
  await page.getByRole("radio", { name: /Quero começar a vender/ }).click();
  await page.getByRole("button", { name: "Continuar" }).click();

  await page.getByRole("button", { name: "Ver mais temas" }).click();
  await expect(page.getByRole("button", { name: "Pets", exact: true })).toBeVisible();
  for (const theme of ["Beleza", "Pets", "Tecnologia"]) {
    await page.getByRole("button", { name: theme, exact: true }).click();
  }
  await expect(page.getByText("3/3 selecionados")).toBeVisible();
  await page.getByRole("button", { name: "Fitness", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Você já escolheu 3 temas" })).toBeVisible();

  await page.getByRole("button", { name: "Pets", exact: true }).click();
  await page.getByRole("button", { name: "Outros", exact: true }).click();
  await expect(page.getByLabel("Qual é o seu nicho?")).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.locator("#onboarding-nicho-error")).toContainText("Conte qual é o seu nicho");
  await page.getByLabel("Qual é o seu nicho?").fill("Festas infantis");
  await page.getByRole("button", { name: "Continuar" }).click();

  await expect(page.getByRole("heading", { name: "Escolha como começar." })).toBeVisible();
  await page.getByRole("button", { name: "Continuar gratuitamente" }).click();
  await expect(page.getByRole("heading", { name: "Tudo pronto para começar!" })).toBeVisible();
  expect(fixture.onboardingPayloads.at(-1)).toMatchObject({
    objetivo: "comecar_vender",
    estilos_conteudo: [],
    temas_interesse: ["Beleza", "Tecnologia", "Outros: Festas infantis"],
  });
  expect(fixture.getCreator()).toMatchObject({
    temas_interesse: ["Beleza", "Tecnologia", "Outros: Festas infantis"],
    estilos_conteudo: [],
  });
});

test("onboarding preserva escolhas ao voltar e ao recarregar a página", async ({ page }) => {
  await setup(page, { onboarding: true });
  await page.goto("/descobrir");
  const objetivo = page.getByRole("radio", { name: /Já vendo e quero vender mais/ });
  await objetivo.click();
  await page.getByRole("button", { name: "Continuar" }).click();
  const casa = page.getByRole("button", { name: "Casa", exact: true });
  await casa.click();
  await page.getByRole("button", { name: "Voltar" }).click();
  await expect(objetivo).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(casa).toHaveAttribute("aria-pressed", "true");

  await page.reload();
  await expect(page.locator("#onboarding-form").getByRole("heading", { name: "O que você vende define o seu conteúdo." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Casa", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Voltar" }).click();
  await expect(page.getByRole("radio", { name: /Já vendo e quero vender mais/ })).toHaveAttribute("aria-checked", "true");
});

test("onboarding mostra erro e mantém o plano quando o salvamento falha", async ({ page }) => {
  const fixture = await setup(page, { onboarding: true, failOnboarding: true });
  await page.goto("/descobrir");
  await page.getByRole("radio", { name: /Quero começar a vender/ }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Continuar gratuitamente" }).click();
  await expect(page.locator(".onboarding-action-error")).toContainText("Não conseguimos salvar agora.");
  await expect(page.getByRole("heading", { name: "Escolha como começar." })).toBeVisible();
  expect(fixture.onboardingPayloads).toHaveLength(0);

  await page.getByRole("button", { name: "Continuar gratuitamente" }).click();
  await expect(page.getByRole("heading", { name: "Tudo pronto para começar!" })).toBeVisible();
});

test("onboarding permite pular sem descartar as escolhas já feitas", async ({ page }) => {
  const fixture = await setup(page, { onboarding: true });
  await page.goto("/descobrir");
  await page.getByRole("radio", { name: /Quero criar vídeos para produtos/ }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Tecnologia", exact: true }).click();
  await page.getByRole("button", { name: "Pular temas e formatos" }).click();
  await expect(page.getByRole("heading", { name: "Tudo pronto para começar!" })).toBeVisible();
  expect(fixture.onboardingPayloads.at(-1)).toMatchObject({
    objetivo: "criar_videos",
    temas_interesse: ["Tecnologia"],
  });
});

test("alternância mensal e anual atualiza preço, cobrança e economia", async ({ page }) => {
  await setup(page, { onboarding: true });
  await page.goto("/descobrir");
  await page.getByRole("radio", { name: /Quero começar a vender/ }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();

  const proCard = page.locator(".onboarding-plan-pro");
  await expect(proCard.locator(".onboarding-plan-price strong")).toHaveText("R$ 49,90");
  await expect(proCard).toContainText("Cobrado R$ 49,90 por mês");
  await expect(proCard.locator(".onboarding-plan-savings")).toHaveCount(0);

  await page.getByRole("button", { name: "Anual" }).click();
  await expect(proCard.locator(".onboarding-plan-price strong")).toHaveText("R$ 499,00");
  await expect(proCard).toContainText("Cobrado R$ 499,00 uma vez por ano");
  await expect(proCard).toContainText("Economize R$ 99,80 por ano (17%)");

  await page.getByRole("button", { name: "Mensal" }).click();
  await expect(proCard.locator(".onboarding-plan-price strong")).toHaveText("R$ 49,90");
  await expect(proCard).toContainText("17% OFF");
  await expect(proCard).toContainText("Cobrado R$ 49,90 por mês");
  await expect(proCard.locator(".onboarding-plan-savings")).toHaveCount(0);
});

test("onboarding permite assinar o Pro antes de entrar no painel", async ({ page }, testInfo) => {
  const fixture = await setup(page, { onboarding: true });
  await page.goto("/descobrir");
  await page.getByRole("radio", { name: /Quero começar a vender/ }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("button", { name: "Assinar o Pro" })).toBeVisible();
  await page.getByRole("button", { name: "Assinar o Pro" }).click();
  const dialog = page.getByRole("dialog", { name: "Escolha como pagar." });
  await expect(dialog).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("onboarding-payment-methods.png") });
  await dialog.getByRole("radio", { name: /Pix/ }).click();
  await dialog.getByRole("button", { name: "Ir para o pagamento Pix" }).click();
  await expect(page).toHaveURL(/pagamento-teste/);
  expect(fixture.checkoutPayloads.at(-1)).toMatchObject({ plan: "pro", period: "monthly", method: "pix" });
  expect(fixture.mutations).toContain("POST /creators/onboarding");
  expect(fixture.mutations).toContain("POST /billing/checkout");
  expect(fixture.mutations).not.toContain("POST /assistant/products");
});

test("onboarding encaminha o cartão para o gateway de cartão", async ({ page }) => {
  const fixture = await setup(page, { onboarding: true });
  await page.goto("/descobrir");
  await page.getByRole("radio", { name: /Quero começar a vender/ }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Assinar o Pro" }).click();
  const dialog = page.getByRole("dialog", { name: "Escolha como pagar." });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("radio", { name: /Cartão/ }).click();
  await dialog.getByRole("button", { name: "Ir para o pagamento com cartão" }).click();
  await expect(page).toHaveURL(/pagamento-teste/);
  expect(fixture.checkoutPayloads.at(-1)).toMatchObject({ plan: "pro", period: "monthly", method: "card" });
});

test("onboarding de assinante existente não oferece uma nova compra", async ({ page }) => {
  await setup(page, { onboarding: true, paid: true });
  await page.goto("/descobrir");
  await page.getByRole("radio", { name: /Já vendo e quero vender mais/ }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "Seu acesso já está liberado." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Assinar o Pro" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Começar a usar" })).toBeVisible();
});

test("onboarding inicial cabe no desktop sem rolagem lateral", async ({ page }, testInfo) => {
  await setup(page, { onboarding: true });
  await page.goto("/descobrir");
  await expect(page.getByRole("heading", { name: "Qual é o seu objetivo agora?" })).toBeVisible();
  await expect(page.locator(".onboarding-aside h2")).toContainText("Comece a vender com direção.");
  await expect(page.locator(".onboarding-map")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.waitForTimeout(700);
  await page.screenshot({ path: testInfo.outputPath("onboarding-desktop.png"), fullPage: true });
  await page.getByRole("radio", { name: /Quero começar a vender/ }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Unboxing", exact: true }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("button", { name: "Assinar o Pro" })).toBeVisible();
  await page.waitForTimeout(700);
  await page.screenshot({ path: testInfo.outputPath("onboarding-plan-desktop.png"), fullPage: true });
});

for (const viewport of [{ width: 1366, height: 768 }, { width: 1440, height: 900 }, { width: 1920, height: 960 }]) {
  test(`onboarding sem rolagem interna em ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await setup(page, { onboarding: true });
    await page.goto("/descobrir");

    async function noInternalScroll() {
      // Deixa a transição de etapa e o carregamento das fontes terminarem:
      // medir antes gera um falso overflow por causa do texto ainda em fallback.
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(450);
      const size = await page.evaluate(() => {
        const form = document.querySelector<HTMLElement>("#onboarding-form");
        return {
          scrollHeight: form?.scrollHeight ?? 0,
          clientHeight: form?.clientHeight ?? 0,
          scrollTop: form?.scrollTop ?? 0,
        };
      });
      expect(size.scrollHeight, "a etapa deve caber sem rolagem interna").toBeLessThanOrEqual(size.clientHeight + 1);
      expect(size.scrollTop).toBe(0);
    }

    await noInternalScroll();
    await page.getByRole("radio", { name: /Quero começar a vender/ }).click();
    await page.getByRole("button", { name: "Continuar" }).click();
    await noInternalScroll();
    await page.getByRole("button", { name: "Unboxing", exact: true }).click();
    await page.getByRole("button", { name: "Continuar" }).click();
    await noInternalScroll();
  });
}

for (const viewport of [{ width: 320, height: 568 }, { width: 360, height: 640 }, { width: 390, height: 844 }, { width: 390, height: 932 }, { width: 430, height: 932 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1280, height: 720 }, { width: 1366, height: 768 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
  test(`todas as etapas do onboarding cabem em ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await setup(page, { onboarding: true });
    await page.goto("/descobrir");

    async function fitsViewport() {
      const size = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        buttonBottom: document.querySelector("#onboarding-next")?.getBoundingClientRect().bottom ?? 0,
        formBottom: document.querySelector("#onboarding-form")?.getBoundingClientRect().bottom ?? 0,
        actionsTop: document.querySelector(".onboarding-actions")?.getBoundingClientRect().top ?? 0,
      }));
      expect(size.width).toBeLessThanOrEqual(size.viewportWidth);
      expect(size.height).toBeLessThanOrEqual(size.viewportHeight);
      expect(size.buttonBottom).toBeLessThanOrEqual(size.viewportHeight);
      expect(size.formBottom).toBeLessThanOrEqual(size.actionsTop + 1);
    }

    await fitsViewport();
    if (viewport.width === 360) {
      await page.waitForTimeout(500);
      await page.screenshot({ path: testInfo.outputPath("onboarding-small-mobile.png") });
    }
    await page.getByRole("radio", { name: /Quero começar a vender/ }).click();
    await page.getByRole("button", { name: "Continuar" }).click();
    await fitsViewport();
    await page.getByRole("button", { name: "Unboxing", exact: true }).click();
    await page.getByRole("button", { name: "Continuar" }).click();
    await fitsViewport();
    await expect(page.locator("#onboarding-form").getByRole("heading", { name: "Escolha como começar.", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Assinar o Pro" })).toBeVisible();
    if (viewport.width === 360) {
      await page.waitForTimeout(500);
      await page.screenshot({ path: testInfo.outputPath("onboarding-done-small-mobile.png") });
    }
    await fitsViewport();
  });
}

test("cada mensagem do assistente aparece uma única vez no DOM", async ({ page }) => {
  await setup(page);
  await page.goto("/descobrir");

  const input = page.locator("#assistant-input");
  await input.fill("garrafa térmica para vender");
  await page.keyboard.press("Enter");

  await expect(page.locator(".chat-turn")).toHaveCount(1);
  await expect(page.locator(".chat-message")).toHaveCount(1);
  await expect(page.locator(".chat-card")).toHaveCount(1);

  // Abre um novo turno: o anterior vira histórico e o atual recebe a nova resposta.
  await input.fill("quero algo mais barato");
  await page.keyboard.press("Enter");

  await expect(page.locator(".chat-turn")).toHaveCount(2);
  await expect(page.locator(".chat-message")).toHaveCount(2);
});
