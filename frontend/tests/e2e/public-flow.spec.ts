import { expect, test } from "@playwright/test";

test("landing apresenta a proposta e leva ao cadastro", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/TemTrend/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("link", { name: /começar agora/i }).first().click();
  await expect(page).toHaveURL(/\/app\?mode=signup/);
  await expect(page.getByRole("heading", { name: /comece a vender/i })).toBeVisible();
});

test("login, termos e privacidade estão acessíveis", async ({ page }) => {
  await page.goto("/app");
  await expect(page.getByRole("button", { name: /continuar com google/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /continuar com facebook/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /continuar com apple/i })).toBeVisible();
  await expect(page.getByPlaceholder("seu@email.com").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /entrar →/i })).toBeVisible();
  // Recuperação de senha
  await page.getByRole("button", { name: /esqueci minha senha/i }).click();
  await expect(page.getByRole("heading", { name: /esqueceu sua senha/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /enviar link →/i })).toBeVisible();
  await page.getByRole("button", { name: /voltar para entrar/i }).click();
  // Cadastro com email
  await page.getByRole("tab", { name: /criar conta/i }).click();
  await expect(page.getByPlaceholder("Como podemos chamar você?")).toBeVisible();
  await expect(page.getByRole("button", { name: /começar agora →/i })).toBeVisible();
  await page.goto("/termos");
  await expect(page.getByRole("heading", { name: /termos de uso/i })).toBeVisible();
  await page.goto("/privacidade");
  await expect(page.getByRole("heading", { name: /política de privacidade/i })).toBeVisible();
});

test("headers defensivos são enviados", async ({ request }) => {
  const response = await request.get("/");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(response.headers()["permissions-policy"]).toContain("camera=()");
});
