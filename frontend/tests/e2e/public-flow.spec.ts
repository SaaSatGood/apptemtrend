import { expect, test } from "@playwright/test";

test("landing apresenta a proposta e leva ao cadastro", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/TemTrend/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("link", { name: /começar agora/i }).first().click();
  await expect(page).toHaveURL(/\/app\?mode=signup/);
  await expect(page.getByRole("heading", { name: /comece a vender/i })).toBeVisible();
});

test("todas as seções da landing aparecem mesmo antes da rolagem", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".tt-home.tt-motion-ready")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: /Ideias de produto para explorar/ })).toHaveCount(1);
  const hiddenSections = await page.locator("[data-motion]").evaluateAll((elements) =>
    elements.filter((element) => getComputedStyle(element).opacity === "0").length
  );
  expect(hiddenSections).toBe(0);
});

test("busca da landing acompanha o creator até o cadastro", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("O que você quer vender?").fill("produto de beleza até R$ 50");
  await page.getByRole("button", { name: /Encontrar produtos/ }).click();
  await expect(page).toHaveURL(/search=produto%20de%20beleza%20at%C3%A9%20R%24%2050/);
  await expect(page.getByRole("heading", { name: /comece a vender/i })).toBeVisible();
});

test("login, termos e privacidade estão acessíveis", async ({ page }) => {
  await page.goto("/app");
  await expect(page.getByRole("button", { name: /continuar com google/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /continuar com facebook/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /continuar com apple/i })).toBeVisible();
  await expect(page.getByPlaceholder("seu@email.com").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /entrar/i })).toBeVisible();
  // Recuperação de senha
  await page.getByRole("button", { name: /esqueci minha senha/i }).click();
  await expect(page.getByRole("heading", { name: /esqueceu sua senha/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /enviar link/i })).toBeVisible();
  await page.getByRole("button", { name: /voltar para entrar/i }).click();
  // Cadastro com email
  await page.getByRole("tab", { name: /criar conta/i }).click();
  await expect(page.getByPlaceholder("Como podemos chamar você?")).toBeVisible();
  await expect(page.getByRole("button", { name: /começar agora/i })).toBeVisible();
  await page.goto("/termos");
  await expect(page.getByRole("heading", { name: /termos de uso/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Voltar ao início" })).toBeVisible();
  await page.goto("/privacidade");
  await expect(page.getByRole("heading", { name: /política de privacidade/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Acessar a plataforma" })).toBeVisible();
});

test("endereço inexistente mostra saída útil", async ({ page }) => {
  const response = await page.goto("/caminho-inexistente");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: /Esse caminho não existe/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ir para o início" })).toBeVisible();
});

test("headers defensivos são enviados", async ({ request }) => {
  const response = await request.get("/");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(response.headers()["permissions-policy"]).toContain("camera=()");
});

for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 360, height: 640 }, { width: 1280, height: 720 }]) {
  test(`criar conta cabe em ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto("/app?mode=signup");
    await expect(page.getByRole("button", { name: /começar agora/i })).toBeVisible();
    const size = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      buttonBottom: document.querySelector(".auth-form .primary")?.getBoundingClientRect().bottom ?? 0,
    }));
    expect(size.width).toBeLessThanOrEqual(size.viewportWidth);
    expect(size.height).toBeLessThanOrEqual(size.viewportHeight);
    expect(size.buttonBottom).toBeLessThanOrEqual(size.viewportHeight);
    if (viewport.width === 360) await page.screenshot({ path: testInfo.outputPath("signup-small-mobile.png") });
  });
}
