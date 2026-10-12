import { expect, test, type Page } from "@playwright/test";

// All authenticated requests in this suite are isolated fixtures, never live writes.
const userId = "11111111-1111-4111-8111-111111111111";
const productId = "33333333-3333-4333-8333-333333333333";
const kitId = "44444444-4444-4444-8444-444444444444";
const productionId = "55555555-5555-4555-8555-555555555555";
const product = { id: productId, nome: "Organizador de cozinha", categoria: "Casa e cozinha", preco_texto: "R$ 29,90", preco_min_brl: 29.9, unidades_vendidas_periodo: 125, imagem_url: "/temtrend-mark.svg", descricao: "Organize seus utensílios e deixe a bancada livre.", tiktok_shop_url: "https://www.tiktok.com/" };
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

async function setup(page: Page, options: { saved?: boolean; onboarding?: boolean; failSearch?: boolean; comparison?: boolean; sensitive?: boolean; productOverride?: Partial<typeof product> } = {}) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: userId, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.signature`;
  await page.addInitScript(({ token, userId }) => {
    localStorage.setItem("sb-iwktyugnwtdroberoces-auth-token", JSON.stringify({ access_token: token, refresh_token: "fixture", expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: "bearer", user: { id: userId, email: "creator@temtrend.test", role: "authenticated", aud: "authenticated", app_metadata: {}, user_metadata: { full_name: "Rafa" }, created_at: "2026-10-09T00:00:00Z" } }));
  }, { token, userId });
  await page.route("**/auth/v1/**", (route) => route.fulfill({ json: { id: userId, email: "creator@temtrend.test", user_metadata: { full_name: "Rafa" } } }));
  let status = options.saved ? "salvo" : "";
  const fixtureProduct = { ...product, ...options.productOverride };
  let hasKit = Boolean(options.saved);
  let onboarded = !options.onboarding;
  let searchCalls = 0;
  let kitInstructions = "";
  const mutations: string[] = [];
  const production = () => ({ id: productionId, creator_id: userId, product_id: productId, content_kit_id: kitId, status, products: fixtureProduct, content_kits: kit, atualizado_em: "2026-10-09T12:00:00Z" });
  await page.route("http://localhost:3333/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const method = req.method();
    if (method !== "GET") mutations.push(`${method} ${path}`);
    if (path === "/me") return route.fulfill({ json: { user_id: userId, creator: { id: userId, estilos_conteudo: [], temas_interesse: [] }, onboarding_completo: onboarded, is_admin: false } });
    if (path === "/products") return route.fulfill({ json: [fixtureProduct, { ...product, id: "66666666-6666-4666-8666-666666666666", nome: "Kit de cuidados para cabelo", categoria: "Beleza", preco_min_brl: 79.9, preco_texto: "R$ 79,90" }] });
    if (path === `/products/${productId}`) return route.fulfill({ json: { product: fixtureProduct, content_kits: hasKit ? [kit] : [] } });
    if (path === `/products/${productId}/content-kit`) { kitInstructions = req.postDataJSON().instructions || ""; hasKit = true; return route.fulfill({ json: { content_kit: kit, created: true } }); }
    if (path === "/creator-content" && method === "GET") return route.fulfill({ json: status ? [production()] : [] });
    if (path === "/creator-content" && method === "POST") { hasKit = true; status = req.postDataJSON().product_id ? "salvo" : "em_producao"; return route.fulfill({ json: production() }); }
    if (path === `/creator-content/${productionId}/content-kit`) { status = "em_producao"; return route.fulfill({ json: production() }); }
    if (path === `/creator-content/${productionId}`) { status = req.postDataJSON().status; return route.fulfill({ json: production() }); }
    if (path === "/assistant/products") {
      searchCalls++;
      if (options.failSearch && searchCalls === 1) return route.fulfill({ status: 503, json: { error: { message: "Tente novamente em instantes." } } });
      if (req.postDataJSON().message === "Olá") return route.fulfill({ json: { message: "O que você quer vender? Posso sugerir por preço, nicho ou facilidade de gravar.", products: [], needs_clarification: true } });
      if (req.postDataJSON().message === "Quero produtos fáceis de demonstrar em vídeo") return route.fulfill({ json: { message: "Para sugerir algo fácil de gravar, diga um nicho ou produto. O catálogo não informa a facilidade de demonstração.", products: [], needs_clarification: true } });
      if (options.comparison || options.sensitive) return route.fulfill({ json: { message: "Encontrei 5 produtos para você.", products: options.sensitive ? [...comparisonProducts.slice(0, 4), { ...comparisonProducts[4], nome: "Camisola delicada", categoria: "Lingerie" }] : comparisonProducts } });
      return route.fulfill({ json: { message: "Encontrei uma oportunidade no catálogo.", products: [{ ...product, motivo: "Preço acessível · 125 vendidos" }] } });
    }
    if (path === "/creators/onboarding") { onboarded = true; return route.fulfill({ json: {} }); }
    if (path === "/account") return route.fulfill({ json: { nome: "Rafa", email: "creator@temtrend.test" } });
    return route.fulfill({ status: 404, json: { error: { message: `Unmocked: ${path}` } } });
  });
  return { mutations, getStatus: () => status, getKitInstructions: () => kitInstructions };
}

test("descoberta, kit e produção até publicação manual", async ({ page }, testInfo) => {
  const fixture = await setup(page);
  await page.goto("/app");
  await expect(page.getByRole("heading", { name: /Descubra o que vale/ })).toBeVisible();
  await page.getByLabel("O que você quer vender?").fill("organizador de cozinha");
  await page.getByRole("button", { name: "Encontrar produtos →" }).click();
  await expect(page.getByText("1 produto encontrado")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Conheça o produto encontrado" })).toBeVisible();
  expect(await page.locator(".discovery-hero").evaluate((element) => element.getBoundingClientRect().height)).toBeLessThan(450);
  await expect(page.getByText(/Preço acessível/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("discover-desktop.png"), fullPage: true });
  await page.getByRole("button", { name: "Ver produto Organizador de cozinha" }).click();
  await expect(page.getByRole("heading", { name: product.nome, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Criar conteúdo →", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "+ Sem aparecer" }).click();
  await expect(dialog.getByRole("button", { name: "✓ Sem aparecer" })).toHaveAttribute("aria-pressed", "true");
  await dialog.getByLabel("Algum detalhe importante? (opcional)").fill("Um vídeo de 15 segundos");
  await dialog.getByRole("button", { name: "Criar conteúdo →" }).click();
  await expect(page.getByRole("heading", { name: kit.titulo })).toBeVisible();
  expect(fixture.getKitInstructions()).toContain("sem mostrar o rosto");
  expect(fixture.getKitInstructions()).toContain("Um vídeo de 15 segundos");
  expect(fixture.getStatus()).toBe("");
  const guide = page.locator(".recording-guide");
  await expect(page.getByText("Classificação: RISING")).toHaveCount(0);
  await expect(page.getByText("125 vendas no período")).toBeVisible();
  await guide.getByRole("button", { name: /Cena 2/ }).click();
  await expect(guide.getByText("Confira o produto no TikTok Shop.")).toBeVisible();
  await guide.getByRole("button", { name: /Cena 1/ }).click();
  await guide.getByLabel("Já gravei esta cena").check();
  await guide.getByRole("button", { name: /Cena 2/ }).click();
  await guide.getByLabel("Já gravei esta cena").check();
  await expect(guide.getByText("2 de 2 cenas gravadas")).toBeVisible();
  await expect(guide.getByRole("heading", { name: "Pronto para publicar" })).toBeVisible();
  await expect(guide.getByText("Áudio discreto para acompanhar a demonstração.")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("kit-desktop.png"), fullPage: true });
  await guide.getByRole("button", { name: "Marcar como publicado →" }).click();
  await expect(dialog.getByText(/Publique fora da TemTrend/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(guide.getByRole("button", { name: "Marcar como publicado →" })).toBeFocused();
  await guide.getByRole("button", { name: "Marcar como publicado →" }).click();
  await dialog.getByRole("button", { name: "Salvar publicação →" }).click();
  await expect(guide.getByText("Publicado", { exact: true })).toBeVisible();
  expect(fixture.getStatus()).toBe("publicado");
  await guide.getByRole("link", { name: "Minha produção →" }).click();
  await page.getByRole("button", { name: /^Publicados/ }).click();
  await expect(page.getByRole("heading", { name: product.nome })).toBeVisible();
});

test("salvo não avança ao abrir o kit; retomada no celular", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const fixture = await setup(page, { saved: true });
  await page.goto("/app");
  await expect(page.getByRole("heading", { name: "Continue de onde parou" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("discover-mobile.png"), fullPage: true });
  await page.getByRole("link", { name: "Produção", exact: true }).click();
  await page.getByRole("button", { name: /^Em produção/ }).click();
  await expect(page.getByRole("heading", { name: "Nenhum conteúdo encontrado." })).toBeVisible();
  await page.getByRole("button", { name: /^Salvos/ }).click();
  await page.getByRole("link", { name: "Ver conteúdo →" }).click();
  const guide = page.locator(".recording-guide");
  await expect(guide.getByRole("heading", { name: "Grave uma etapa de cada vez." })).toBeVisible();
  await expect(page.locator(".kit-document, .kit-actions")).toHaveCount(0);
  expect(fixture.mutations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("kit-mobile.png"), fullPage: true });
  await guide.getByRole("combobox", { name: "Escolher etapa do roteiro" }).selectOption("3");
  await guide.getByRole("button", { name: "Marcar como gravado →" }).click();
  await expect(guide.getByRole("heading", { name: "Pronto para publicar" })).toBeVisible();
  expect(fixture.getStatus()).toBe("gravado");
});

test("busca preserva texto após erro e atalho busca produtos reais", async ({ page }) => {
  await setup(page, { failSearch: true });
  await page.goto("/app");
  await page.getByLabel("O que você quer vender?").fill("Produtos para casa");
  await page.getByRole("button", { name: "Encontrar produtos →" }).click();
  await expect(page.getByRole("button", { name: "Tentar novamente", exact: true })).toBeVisible();
  await expect(page.getByLabel("O que você quer vender?")).toHaveValue("Produtos para casa");
  await page.getByRole("button", { name: "Tentar novamente", exact: true }).click();
  await expect(page.getByRole("heading", { name: product.nome })).toBeVisible();
  await page.getByRole("button", { name: "Voltar a explorar" }).click();
  await page.getByRole("button", { name: "Não sei o que vender" }).click();
  await expect(page.getByRole("heading", { name: product.nome })).toBeVisible();
});

test("resultados exibem cinco produtos comparáveis e ações diretas", async ({ page }, testInfo) => {
  const fixture = await setup(page, { comparison: true });
  await page.goto("/app");
  await page.getByLabel("O que você quer vender?").fill("Produtos para casa");
  await page.getByRole("button", { name: "Encontrar produtos →" }).click();
  await expect(page.getByText("5 produtos encontrados")).toBeVisible();
  const cards = page.locator(".assistant-response .opportunity-card");
  await expect(cards).toHaveCount(5);
  await expect(cards.first().getByRole("heading")).toHaveText("Organizador de cozinha");
  await expect(page.getByRole("button", { name: /Mostrar mais/ })).toHaveCount(0);
  for (const card of await cards.all()) {
    await expect(card.locator(".opportunity-metrics dt")).toHaveText(["Preço", "Comissão / venda", "Vendas"]);
    await expect(card.getByRole("button", { name: /^Salvar / })).toBeVisible();
    await expect(card.getByRole("button", { name: /^Gerar roteiro para/ })).toBeVisible();
  }
  await expect(cards.nth(3).getByText("Maior comissão estimada")).toBeVisible();
  await expect(cards.nth(2).getByText("Maior comissão estimada")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("five-comparable-products.png"), fullPage: true });

  await cards.first().getByRole("button", { name: "Salvar Organizador de cozinha" }).click();
  await expect(cards.first().getByText("Salvo ✓").first()).toBeVisible();
  await expect(page).toHaveURL(/\/app$/);
  expect(fixture.mutations).toContain("POST /creator-content");

  await cards.first().getByRole("button", { name: "Gerar roteiro para Organizador de cozinha" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Criar conteúdo →" }).click();
  await expect(page.getByRole("heading", { name: kit.titulo })).toBeVisible();
});

test("saudação pede uma direção antes de sugerir produtos", async ({ page }) => {
  await setup(page);
  await page.goto("/app");
  await page.getByLabel("O que você quer vender?").fill("Olá");
  await page.getByRole("button", { name: "Encontrar produtos →" }).click();
  await expect(page.getByText(/O que você quer vender\? Posso sugerir/)).toBeVisible();
  await expect(page.locator(".assistant-response .opportunity-card")).toHaveCount(0);
  await expect(page.getByText("Nenhum produto encontrado.")).toHaveCount(0);
  await page.getByRole("button", { name: "Fáceis de gravar →" }).click();
  await expect(page.getByText(/O catálogo não informa a facilidade/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Fáceis de gravar →" })).toHaveCount(0);
  await page.getByRole("button", { name: "Por nicho →" }).click();
  await expect(page.getByRole("heading", { name: product.nome })).toBeVisible();
});

test("resultados e ações cabem na largura do celular", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, { comparison: true });
  await page.goto("/app");
  await page.getByLabel("O que você quer vender?").fill("Produtos para casa");
  await page.getByRole("button", { name: "Encontrar produtos →" }).click();
  const cards = page.locator(".assistant-response .opportunity-card");
  await expect(cards).toHaveCount(5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(cards.last().getByRole("button", { name: "Gerar roteiro para Garrafa térmica" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("five-comparable-products-mobile.png"), fullPage: true });
});

test("categoria sensível recebe aviso e pode ser ocultada sem falsear a contagem", async ({ page }) => {
  await setup(page, { sensitive: true });
  await page.goto("/app");
  await page.getByLabel("O que você quer vender?").fill("produtos variados");
  await page.getByRole("button", { name: "Encontrar produtos →" }).click();
  await expect(page.locator(".assistant-response .opportunity-card")).toHaveCount(5);
  await expect(page.getByText("Pode ter restrição de anúncio ou criativo no TikTok.")).toBeVisible();
  await page.getByLabel("Ocultar categorias sensíveis").check();
  await expect(page.locator(".assistant-response .opportunity-card")).toHaveCount(4);
  await expect(page.getByText(/4 de 5 visíveis com seu filtro/)).toBeVisible();
});

test("guia do roteiro conduz a gravação por etapas no celular", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, { saved: true });
  await page.goto(`/app/produtos/${productId}/kits/${kitId}`);
  const guide = page.locator(".recording-guide");
  await expect(guide.getByRole("heading", { name: "Grave uma etapa de cada vez." })).toBeVisible();
  await expect(guide.getByRole("combobox", { name: "Escolher etapa do roteiro" })).toBeVisible();
  await expect(guide.locator(".recording-guide-steps")).toBeHidden();
  await expect(guide.locator(".recording-guide-reference")).toHaveCount(0);
  await expect(guide.getByRole("button", { name: /Ouvir etapa|Parar leitura/ })).toHaveCount(0);
  for (const item of ["Produto à mão", "Boa luz", "Fundo organizado", "Lente limpa"]) {
    await expect(guide.getByRole("button", { name: item })).toBeVisible();
  }
  await guide.getByRole("button", { name: "Boa luz" }).click();
  await expect(guide.getByRole("button", { name: "Boa luz" })).toHaveAttribute("aria-pressed", "true");
  await guide.getByRole("button", { name: "Marcar como concluída →" }).click();
  await expect(guide.getByRole("heading", { name: "Abertura" })).toBeVisible();
  await expect(guide.getByRole("button", { name: "Usar este hook" })).toHaveCount(3);
  expect(await guide.locator(".recording-guide-choices").evaluate((element) => element.scrollHeight <= element.clientHeight)).toBe(true);
  await guide.getByRole("button", { name: "Usar este hook" }).first().click();
  await expect(guide.locator(".recording-guide-details").getByText("Sua bancada vive cheia?")).toBeVisible();
  await expect(guide.getByRole("button", { name: "Em uso ✓" })).toBeVisible();
  await guide.getByRole("combobox", { name: "Escolher etapa do roteiro" }).selectOption("2");
  await expect(guide.getByText("Olha esta ideia")).toBeVisible();
  await guide.getByLabel("Já gravei esta cena").check();
  await expect(guide.getByText("1 de 2 cenas gravadas")).toBeVisible();
  await guide.getByRole("button", { name: "Voltar" }).click();
  await expect(guide.getByRole("heading", { name: "Abertura" })).toBeVisible();
  await page.reload();
  await guide.getByRole("combobox", { name: "Escolher etapa do roteiro" }).selectOption("1");
  await expect(guide.locator(".recording-guide-details").getByText("Sua bancada vive cheia?")).toBeVisible();
  await expect(guide.getByText("1 de 2 cenas gravadas")).toBeVisible();
  await guide.getByRole("combobox", { name: "Escolher etapa do roteiro" }).selectOption("3");
  await expect(guide.getByText("Confira o produto no TikTok Shop.")).toBeVisible();
  await expect(guide.getByText(/se ainda tem disponível/i)).toHaveCount(0);
  const more = guide.locator(".recording-guide-more");
  await expect(more).not.toHaveAttribute("open");
  await more.locator("summary").click();
  await expect(more.getByRole("button", { name: "Usar esta variação →" })).toHaveCount(5);
  await more.getByRole("button", { name: "Usar esta variação →" }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Algum detalhe importante? (opcional)")).toHaveValue(/Antes e depois da bancada/);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("guided-kit-mobile.png"), fullPage: true });
  await guide.getByLabel("Já gravei esta cena").check();
  await expect(guide.getByRole("heading", { name: "Pronto para publicar" })).toBeVisible();
});

test("detalhes, guia e produção mantêm o nome completo e a largura em três telas", async ({ page }, testInfo) => {
  const longName = "Kit 2 Colares Prata e Ouro com Coração e Correntes Delicadas para Compor Looks";
  await setup(page, { saved: true, productOverride: { nome: longName, imagem_url: "" } });
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/app");
    await expect(page.getByRole("heading", { name: "Continue de onde parou" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.goto(`/app/produtos/${productId}`);
    await expect(page.getByRole("heading", { name: longName, exact: true })).toBeVisible();
    if (width === 390) expect(await page.getByRole("heading", { name: longName, exact: true }).evaluate((element) => element.getBoundingClientRect().height / parseFloat(getComputedStyle(element).lineHeight))).toBeLessThanOrEqual(2.15);
    await expect(page.getByText("Imagem do produto")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Ver conteúdo →" })).toBeVisible();
    if (width === 390) await page.screenshot({ path: testInfo.outputPath("product-detail-mobile.png"), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.goto(`/app/produtos/${productId}/kits/${kitId}`);
    await expect(page.getByRole("heading", { name: kit.titulo })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width > 760) {
      await expect(page.getByRole("navigation", { name: "Etapas do roteiro" })).toBeVisible();
      expect(await page.locator(".recording-guide-steps").evaluate((element) => element.scrollHeight <= element.clientHeight)).toBe(true);
    }
    await page.goto("/app/producao");
    await expect(page.getByRole("heading", { name: longName, exact: true })).toBeVisible();
    await expect(page.getByText("Imagem do produto")).toHaveCount(0);
    if (width === 390) await page.screenshot({ path: testInfo.outputPath("production-mobile.png"), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("conta mostra ações secundárias e estado de erro recuperável", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page.goto("/app/conta");
  await expect(page.getByRole("heading", { name: "Minha conta." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Atualizar senha" })).toHaveClass(/ghost/);
  await expect(page.getByText("Voz atualizada ✓")).toBeVisible();
  await expect(page.getByRole("button", { name: "Dados atualizados ✓" })).toHaveCount(0);
  const cardOrder = await page.locator(".account-layout .account-card").evaluateAll((cards) => cards.map((card) => ({ title: card.querySelector("h2")?.textContent || "", top: card.getBoundingClientRect().top })).sort((a, b) => a.top - b.top).map((card) => card.title));
  expect(cardOrder).toEqual(["Informações do perfil", "Preferências de conteúdo", "Sua voz", "Segurança"]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("account-settings-mobile.png"), fullPage: true });

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
  await page.goto(`/app/produtos/${productId}`);
  await expect(page.getByRole("heading", { name: longName, exact: true })).toBeVisible();
  await expect(page.locator(".kit-empty-preview span")).toHaveText(["Hook", "5 cenas", "Legenda", "Hashtags", "CTA"]);
  await expect(page.getByRole("button", { name: "Criar conteúdo →" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Salvar produto" })).toBeVisible();
  await expect(page.locator("#product-detail .primary")).toHaveCount(1);
  await expect(page.getByText("Use os dados confirmados do produto para gerar seu roteiro.")).toHaveCount(0);
});

test("criação de conteúdo cabe no celular sem rolagem lateral", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page.goto(`/app/produtos/${productId}`);
  await page.getByRole("button", { name: "Criar conteúdo →", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Seu vídeo começa aqui." })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Criar conteúdo →" })).toBeInViewport();
  expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth && node.scrollHeight <= node.clientHeight + 1)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("create-content-mobile.png") });
});

test("produção ordena pela próxima ação e ajusta o botão ao estado", async ({ page }) => {
  await setup(page);
  const states = [
    { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", status: "publicado", nome: "Produto publicado", updated: "2026-10-11T12:00:00Z" },
    { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", status: "salvo", nome: "Produto salvo", updated: "2026-10-09T12:00:00Z" },
    { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", status: "em_producao", nome: "Produto em gravação", updated: "2026-10-08T12:00:00Z" },
    { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", status: "gravado", nome: "Produto gravado", updated: "2026-10-10T12:00:00Z" },
  ];
  await page.route("http://localhost:3333/creator-content?*", (route) => route.fulfill({ json: states.map((item) => ({ id: item.id, creator_id: userId, product_id: productId, content_kit_id: item.status === "salvo" ? null : kitId, status: item.status, products: { ...product, nome: item.nome, imagem_url: "" }, content_kits: item.status === "salvo" ? null : kit, atualizado_em: item.updated })) }));
  await page.goto("/app/producao");
  const cards = page.locator(".production-card:not(.production-skeleton)");
  await expect(cards).toHaveCount(4);
  await expect(cards.locator(".production-status")).toHaveText(["Em produção", "Salvo", "Gravado", "Publicado ✓"]);
  await expect(cards.nth(0).getByText("Gravar cena 1 de 2")).toBeVisible();
  await expect(cards.nth(1).getByRole("link", { name: "Criar conteúdo →" })).toBeVisible();
  await expect(cards.nth(2).getByRole("button", { name: "Publicar →" })).toBeVisible();
  await page.getByRole("combobox", { name: "Ordenação" }).selectOption("recentes");
  await expect(cards.first().getByRole("heading", { name: "Produto publicado" })).toBeVisible();
});

test("onboarding em cinco etapas e menu acessível", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, { onboarding: true });
  await page.goto("/app");
  await page.getByRole("radio", { name: /Quero começar a vender/ }).click();
  await page.getByRole("button", { name: "Continuar →" }).click();
  await page.getByRole("button", { name: "Unboxing", exact: true }).click();
  await page.getByRole("button", { name: "Continuar →" }).click();
  await page.getByRole("button", { name: "Casa", exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath("onboarding-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "Continuar →" }).click();
  await expect(page.getByRole("heading", { name: "Como você fala nos vídeos?" })).toBeVisible();
  await page.getByPlaceholder(/Gente, preciso mostrar/).fill("Falo direto, sem enrolação, e mostro o teste na hora.");
  await page.getByRole("button", { name: "Concluir configuração →" }).click();
  await expect(page.getByRole("heading", { name: "Pronto.", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ir para Descobrir →" }).click();
  await page.getByLabel("Abrir menu da conta").click();
  await expect(page.getByRole("link", { name: "Minha conta", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("link", { name: "Minha conta", exact: true })).toBeHidden();
  await page.getByLabel("Abrir menu da conta").click();
  await page.getByRole("link", { name: "Preferências", exact: true }).click();
  await expect(page.getByRole("heading", { name: "O que você quer fazer no TikTok?" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("account-mobile.png"), fullPage: true });
});

test("onboarding inicial cabe no desktop sem rolagem lateral", async ({ page }, testInfo) => {
  await setup(page, { onboarding: true });
  await page.goto("/app");
  await expect(page.getByRole("heading", { name: "O que você quer fazer no TikTok?" })).toBeVisible();
  await expect(page.getByText("Vamos dar direção às suas ideias.")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("onboarding-desktop.png"), fullPage: true });
});

for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 360, height: 640 }, { width: 390, height: 932 }, { width: 768, height: 1024 }, { width: 1280, height: 720 }]) {
  test(`todas as etapas do onboarding cabem em ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await setup(page, { onboarding: true });
    await page.goto("/app");

    async function fitsViewport() {
      const size = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        buttonBottom: document.querySelector("#onboarding-next")?.getBoundingClientRect().bottom ?? 0,
        contentBottom: document.querySelector(".onboarding-step.is-active")?.getBoundingClientRect().bottom ?? 0,
        actionsTop: document.querySelector(".onboarding-actions")?.getBoundingClientRect().top ?? 0,
      }));
      expect(size.width).toBeLessThanOrEqual(size.viewportWidth);
      expect(size.height).toBeLessThanOrEqual(size.viewportHeight);
      expect(size.buttonBottom).toBeLessThanOrEqual(size.viewportHeight);
      expect(size.contentBottom).toBeLessThanOrEqual(size.actionsTop);
    }

    await fitsViewport();
    if (viewport.width === 360) await page.screenshot({ path: testInfo.outputPath("onboarding-small-mobile.png") });
    await page.getByRole("radio", { name: /Quero começar a vender/ }).click();
    await page.getByRole("button", { name: "Continuar →" }).click();
    await fitsViewport();
    await page.getByRole("button", { name: "Unboxing", exact: true }).click();
    await page.getByRole("button", { name: "Continuar →" }).click();
    await fitsViewport();
    await page.getByRole("button", { name: "Casa", exact: true }).click();
    await page.getByRole("button", { name: "Continuar →" }).click();
    await fitsViewport();
    await page.getByPlaceholder(/Gente, preciso mostrar/).fill("Falo direto e mostro o teste na hora.");
    await page.getByRole("button", { name: "Concluir configuração →" }).click();
    await fitsViewport();
    if (viewport.width === 360) await page.screenshot({ path: testInfo.outputPath("onboarding-done-small-mobile.png") });
  });
}
