import { expect, test, type Page, type Route } from "@playwright/test";

const userId = "11111111-1111-4111-8111-111111111111";
const productId = "33333333-3333-4333-8333-333333333333";
const kitId = "44444444-4444-4444-8444-444444444444";
const product = { id: productId, nome: "Organizador de cozinha", categoria: "Casa e cozinha", preco_texto: "R$ 29,90", preco_min_brl: 29.9, unidades_vendidas_periodo: 125, imagem_url: "/temtrend-mark.svg", descricao: "Organize seus utensílios e deixe a bancada livre.", tiktok_shop_url: "https://www.tiktok.com/" };
const kit = { id: kitId, product_id: productId, titulo: "Uma bancada mais organizada", hook: "Sua cozinha pode ganhar espaço", cenas: [{ tempo: "0–5s", mostre: "Mostre a bancada", fale: "Olha esta ideia", acao_edicao: "Corte para o produto" }, { tempo: "5–10s", mostre: "Mostre o resultado", fale: "Ficou ótimo", acao_edicao: "Zoom no detalhe" }, { tempo: "10–15s", mostre: "Chamada final", fale: "Confira o link", acao_edicao: "Texto na tela" }, { tempo: "15–20s", mostre: "Extra um", fale: "Bônus", acao_edicao: "Corte seco" }, { tempo: "20–25s", mostre: "Extra dois", fale: "Final", acao_edicao: "Fade" }], copy: "Uma ideia para sua cozinha.", cta: "Confira o produto", hashtags: ["casa", "#organizacao"], duracao_seg: 15 };

async function setup(page: Page) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: userId, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.signature`;
  await page.addInitScript(({ token, userId }) => {
    localStorage.setItem("sb-iwktyugnwtdroberoces-auth-token", JSON.stringify({ access_token: token, refresh_token: "fixture", expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: "bearer", user: { id: userId, email: "creator@temtrend.test", role: "authenticated", aud: "authenticated", app_metadata: {}, user_metadata: { full_name: "Rafa" }, created_at: "2026-10-09T00:00:00Z" } }));
  }, { token, userId });
  await page.route("**/auth/v1/**", (route: Route) => route.fulfill({ json: { id: userId, email: "creator@temtrend.test", user_metadata: { full_name: "Rafa" } } }));
  await page.route("http://localhost:3333/**", async (route: Route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/me") return route.fulfill({ json: { user_id: userId, creator: { id: userId, estilos_conteudo: [], temas_interesse: [] }, onboarding_completo: true, is_admin: false } });
    if (path === `/products/${productId}`) return route.fulfill({ json: { product, content_kits: [kit] } });
    if (path === "/creator-content" && route.request().method() === "GET") return route.fulfill({ json: [] });
    return route.fulfill({ status: 404, json: { error: { message: "x" } } });
  });
}

test("kit cabe numa tela sem scroll no desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await setup(page);
  await page.goto(`/app/produtos/${productId}/kits/${kitId}`);
  await expect(page.getByRole("heading", { name: kit.titulo })).toBeVisible();
  // Nenhuma barra de rolagem vertical renderizada: o usuário não precisa scrollar.
  const noScroll = await page.evaluate(() => window.innerWidth - document.documentElement.clientWidth);
  expect(noScroll).toBe(0);
  // Tudo alcançável sem scroll: barra de ações e botão principal dentro da viewport.
  const reach = await page.evaluate(() => {
    const b = (sel: string) => { const el = document.querySelector(sel); if (!el) return -1; return Math.round((el as HTMLElement).getBoundingClientRect().bottom); };
    return { support: b(".recording-guide-support"), primary: b(".recording-guide-actions .primary"), innerH: window.innerHeight };
  });
  expect(reach.support).toBeLessThanOrEqual(reach.innerH);
  expect(reach.primary).toBeLessThanOrEqual(reach.innerH);
});

test("kit cabe numa tela sem scroll no celular", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page.goto(`/app/produtos/${productId}/kits/${kitId}`);
  await expect(page.getByRole("heading", { name: kit.titulo })).toBeVisible();
  const noScroll = await page.evaluate(() => window.innerWidth - document.documentElement.clientWidth);
  expect(noScroll).toBe(0);
  const reach = await page.evaluate(() => {
    const b = (sel: string) => { const el = document.querySelector(sel); if (!el) return -1; return Math.round((el as HTMLElement).getBoundingClientRect().bottom); };
    return { support: b(".recording-guide-support"), primary: b(".recording-guide-actions .primary"), innerH: window.innerHeight };
  });
  expect(reach.support).toBeLessThanOrEqual(reach.innerH);
  expect(reach.primary).toBeLessThanOrEqual(reach.innerH);
});
