import { expect, test, type Page } from "@playwright/test";

// All authenticated requests in this suite are isolated fixtures, never live writes.
const userId = "11111111-1111-4111-8111-111111111111";
const productId = "33333333-3333-4333-8333-333333333333";
const kitId = "44444444-4444-4444-8444-444444444444";
const productionId = "55555555-5555-4555-8555-555555555555";
const product = { id: productId, nome: "Organizador de cozinha", categoria: "Casa e cozinha", preco_texto: "R$ 29,90", preco_min_brl: 29.9, unidades_vendidas_periodo: 125, imagem_url: "/temtrend-mark.svg", descricao: "Organize seus utensílios e deixe a bancada livre.", tiktok_shop_url: "https://www.tiktok.com/" };
const kit = { id: kitId, product_id: productId, titulo: "Uma bancada mais organizada", hook: "Sua cozinha pode ganhar espaço", cenas: [{ tempo: "0–5s", mostre: "Mostre a bancada", fale: "Olha esta ideia", acao_edicao: "Corte para o produto" }], copy: "Uma ideia para sua cozinha.", cta: "Confira o produto", hashtags: ["casa", "#organizacao"], duracao_seg: 15 };

async function setup(page: Page, options: { saved?: boolean; onboarding?: boolean; failSearch?: boolean } = {}) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: userId, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.signature`;
  await page.addInitScript(({ token, userId }) => {
    localStorage.setItem("sb-iwktyugnwtdroberoces-auth-token", JSON.stringify({ access_token: token, refresh_token: "fixture", expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: "bearer", user: { id: userId, email: "creator@temtrend.test", role: "authenticated", aud: "authenticated", app_metadata: {}, user_metadata: { full_name: "Rafa" }, created_at: "2026-10-09T00:00:00Z" } }));
  }, { token, userId });
  await page.route("**/auth/v1/**", (route) => route.fulfill({ json: { id: userId, email: "creator@temtrend.test", user_metadata: { full_name: "Rafa" } } }));
  let status = options.saved ? "salvo" : "";
  let hasKit = Boolean(options.saved);
  let onboarded = !options.onboarding;
  let searchCalls = 0;
  const mutations: string[] = [];
  const production = () => ({ id: productionId, creator_id: userId, product_id: productId, content_kit_id: kitId, status, products: product, content_kits: kit, atualizado_em: "2026-10-09T12:00:00Z" });
  await page.route("http://localhost:3333/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const method = req.method();
    if (method !== "GET") mutations.push(`${method} ${path}`);
    if (path === "/me") return route.fulfill({ json: { user_id: userId, creator: { id: userId, estilos_conteudo: [], temas_interesse: [] }, onboarding_completo: onboarded, is_admin: false } });
    if (path === "/products") return route.fulfill({ json: [product, { ...product, id: "66666666-6666-4666-8666-666666666666", nome: "Kit de cuidados para cabelo", categoria: "Beleza", preco_min_brl: 79.9, preco_texto: "R$ 79,90" }] });
    if (path === `/products/${productId}`) return route.fulfill({ json: { product, content_kits: hasKit ? [kit] : [] } });
    if (path === `/products/${productId}/content-kit`) { hasKit = true; return route.fulfill({ json: { content_kit: kit, created: true } }); }
    if (path === "/creator-content" && method === "GET") return route.fulfill({ json: status ? [production()] : [] });
    if (path === "/creator-content" && method === "POST") { hasKit = true; status = req.postDataJSON().product_id ? "salvo" : "em_producao"; return route.fulfill({ json: production() }); }
    if (path === `/creator-content/${productionId}/content-kit`) { status = "em_producao"; return route.fulfill({ json: production() }); }
    if (path === `/creator-content/${productionId}`) { status = req.postDataJSON().status; return route.fulfill({ json: production() }); }
    if (path === "/assistant/products") {
      searchCalls++;
      if (options.failSearch && searchCalls === 1) return route.fulfill({ status: 503, json: { error: { message: "Tente novamente em instantes." } } });
      return route.fulfill({ json: { message: "Encontrei uma oportunidade no catálogo.", products: [{ ...product, motivo: "Preço acessível · 125 vendidos" }] } });
    }
    if (path === "/creators/onboarding") { onboarded = true; return route.fulfill({ json: {} }); }
    if (path === "/account") return route.fulfill({ json: { nome: "Rafa", email: "creator@temtrend.test" } });
    return route.fulfill({ status: 404, json: { error: { message: `Unmocked: ${path}` } } });
  });
  return { mutations, getStatus: () => status };
}

test("descoberta, kit e produção até publicação manual", async ({ page }, testInfo) => {
  const fixture = await setup(page);
  await page.goto("/app");
  await expect(page.getByRole("heading", { name: /Descubra o que vale/ })).toBeVisible();
  await page.getByLabel("O que você quer vender?").fill("organizador de cozinha");
  await page.getByRole("button", { name: "Encontrar produtos →" }).click();
  await expect(page.getByText("Top 1 mais vendidos")).toBeVisible();
  await expect(page.getByText(/Preço acessível/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("discover-desktop.png"), fullPage: true });
  await page.getByRole("button", { name: "Ver produto Organizador de cozinha" }).click();
  await expect(page.getByRole("heading", { name: product.nome, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Criar Content Kit →", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Como você imagina o vídeo? (opcional)").fill("Um vídeo de 15 segundos");
  await dialog.getByRole("button", { name: "Criar Content Kit →" }).click();
  await expect(page.getByRole("heading", { name: kit.titulo })).toBeVisible();
  expect(fixture.getStatus()).toBe("");
  await page.getByRole("button", { name: "Copiar CTA" }).click();
  await expect(page.getByRole("button", { name: "Copiado ✓", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Começar produção →" }).click();
  await expect(page.getByRole("button", { name: "Marcar como gravado", exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("kit-desktop.png"), fullPage: true });
  await page.getByRole("button", { name: "Marcar como gravado", exact: true }).click();
  await page.getByRole("button", { name: "Marcar como publicado →" }).click();
  await expect(dialog.getByText(/Publique fora da TemTrend/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Marcar como publicado →" })).toBeFocused();
  await page.getByRole("button", { name: "Marcar como publicado →" }).click();
  await dialog.getByRole("button", { name: "Salvar publicação →" }).click();
  await expect(page.getByRole("heading", { name: "Conteúdo publicado" })).toBeVisible();
  expect(fixture.getStatus()).toBe("publicado");
  await page.getByRole("link", { name: "Ir para Minha produção" }).click();
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
  await page.getByRole("link", { name: "Ver Content Kit →" }).click();
  await expect(page.getByRole("button", { name: "Começar produção →" })).toBeVisible();
  expect(fixture.mutations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("kit-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "Começar produção →" }).click();
  await expect(page.getByRole("button", { name: "Marcar como gravado" })).toBeVisible();
  expect(fixture.getStatus()).toBe("em_producao");
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
  await page.getByRole("button", { name: "Não sei o que vender →" }).click();
  await expect(page.getByRole("heading", { name: product.nome })).toBeVisible();
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
  await page.screenshot({ path: testInfo.outputPath("account-mobile.png"), fullPage: true });
});
