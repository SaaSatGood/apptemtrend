import { expect, test } from "@playwright/test";

const userId = "11111111-1111-4111-8111-111111111111";
const creatorId = "22222222-2222-4222-8222-222222222222";
const productId = "33333333-3333-4333-8333-333333333333";

function fakeJwt() {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: userId, role: "authenticated", email: "admin@temtrend.test", exp: Math.floor(Date.now() / 1000) + 3600 })}.signature`;
}

test("admin organiza operação, catálogo e creators", async ({ page }) => {
  const token = fakeJwt();
  await page.addInitScript(({ tokenValue, id }) => {
    window.localStorage.setItem("sb-iwktyugnwtdroberoces-auth-token", JSON.stringify({
      access_token: tokenValue,
      refresh_token: "refresh-token",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: "bearer",
      user: { id, email: "admin@temtrend.test", role: "authenticated", aud: "authenticated", app_metadata: {}, user_metadata: { full_name: "Admin TemTrend" }, created_at: new Date().toISOString() },
    }));
  }, { tokenValue: token, id: userId });

  await page.route("**/auth/v1/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: userId, email: "admin@temtrend.test", role: "authenticated", aud: "authenticated", app_metadata: {}, user_metadata: { full_name: "Admin TemTrend" } }) });
  });

  await page.route("http://localhost:3333/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/me") {
      return route.fulfill({ json: { user_id: userId, creator: null, onboarding_completo: true, is_admin: true } });
    }
    if (url.pathname === "/admin/dashboard") {
      return route.fulfill({ json: { total_creators: 1, creators_ativos: 1, total_produtos: 2, produtos_ativos: 1, total_content_kits: 4, oportunidades_salvas: 7, conteudos_publicados: 3, ai_classify_calls: 12, ai_generate_calls: 8, ai_classify_tokens: 2200, ai_generate_tokens: 5100 } });
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
});
