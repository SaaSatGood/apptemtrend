import { expect, test } from "@playwright/test";

test("landing apresenta a proposta e leva ao cadastro", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/TemTrend/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("link", { name: /começar agora/i }).first().click();
  await expect(page).toHaveURL(/\/app\?mode=signup/);
  await expect(page.getByRole("heading", { name: /comece a vender/i })).toBeVisible();
});

test("hero mantém o produto visível e o plano legível no celular", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const image = page.locator(".tt-hero-creators-image");
  await expect(image).toHaveAttribute("src", /hero-tumbler-v2/);
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
  const caption = page.locator(".tt-hero-product-preview");
  const imageBox = await image.boundingBox();
  const captionBox = await caption.boundingBox();
  expect(captionBox!.y).toBeGreaterThanOrEqual(imageBox!.y + imageBox!.height - 1);
  const captionText = caption.locator("p");
  const stepText = page.locator(".tt-hero-plan-preview li").first();
  expect(Number.parseFloat(await captionText.evaluate((element) => getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(14);
  expect(Number.parseFloat(await stepText.evaluate((element) => getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(14);
  const planLink = page.getByRole("link", { name: /Veja o plano completo/ });
  await expect(planLink).toHaveAttribute("href", "#content-kits");
  await expect(planLink).toContainText("↓");
});

test("prévia do plano distribui três etapas no desktop e empilha no celular", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const steps = page.locator(".tt-hero-plan-preview li");
  await expect(steps).toHaveCount(3);
  const desktop = await steps.evaluateAll((elements) => elements.map((element) => {
    const box = element.getBoundingClientRect();
    return { x: box.x, y: box.y };
  }));
  expect(desktop[0].x).toBeLessThan(desktop[1].x);
  expect(desktop[1].x).toBeLessThan(desktop[2].x);
  expect(Math.abs(desktop[0].y - desktop[2].y)).toBeLessThan(2);

  const firstStepStyle = await steps.first().evaluate((element) => {
    const style = getComputedStyle(element);
    const number = getComputedStyle(element.querySelector("b")!);
    return { color: style.color, fontSize: Number.parseFloat(style.fontSize), numberBackground: number.backgroundColor, numberRadius: number.borderRadius };
  });
  expect(firstStepStyle.color).toBe("rgb(61, 74, 46)");
  expect(firstStepStyle.fontSize).toBeGreaterThanOrEqual(14);
  const [red, green, blue] = firstStepStyle.numberBackground.match(/\d+/g)!.map(Number);
  expect(green).toBeGreaterThan(red);
  expect(green).toBeGreaterThan(200);
  expect(blue).toBeLessThan(100);
  expect(firstStepStyle.numberRadius).toBe("50%");

  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await steps.evaluateAll((elements) => elements.map((element) => {
    const box = element.getBoundingClientRect();
    return { x: box.x, y: box.y };
  }));
  expect(Math.abs(mobile[0].x - mobile[2].x)).toBeLessThan(2);
  expect(mobile[0].y).toBeLessThan(mobile[1].y);
  expect(mobile[1].y).toBeLessThan(mobile[2].y);
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
  await expect(page.getByRole("button", { name: /criar conta grátis/i })).toBeVisible();
  await page.goto("/termos");
  await expect(page.getByRole("heading", { name: /termos de uso/i })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: "TemTrend, início" })).toBeVisible();
  await page.goto("/privacidade");
  await expect(page.getByRole("heading", { name: /política de privacidade/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Acessar a plataforma" })).toBeVisible();
});

test("navegação pública é consistente e utilizável no celular", async ({ page }) => {
  for (const [width, path] of [[390, "/"], [390, "/planos"], [390, "/termos"], [320, "/"]] as const) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(path);
    const nav = page.getByRole("navigation", { name: "Navegação principal" });
    await expect(nav.getByRole("link", { name: "Criar conta grátis" })).toBeVisible();
    const menu = nav.locator('button[aria-controls="tt-public-links"]');
    await expect(menu).toBeVisible();
    await menu.click();
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await expect(nav.getByRole("link", { name: "Como funciona" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Planos" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});

test("tipografia compartilhada usa Fustat nos títulos e Inter Tight na leitura", async ({ page }) => {
  for (const path of ["/", "/planos", "/termos", "/app?mode=signup"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const fonts = await page.evaluate(async () => {
      await document.fonts.ready;
      return {
        heading: getComputedStyle(document.querySelector("h1, h2")!).fontFamily.replaceAll(" ", "_"),
        body: getComputedStyle(document.body).fontFamily.replaceAll(" ", "_"),
      };
    });
    expect(fonts.heading).toContain("Fustat");
    expect(fonts.body).toContain("Inter_Tight");
  }
});

test("cliques não deixam foco preto e campos usam o foco verde da marca", async ({ page }) => {
  await page.goto("/app");
  const signupTab = page.getByRole("tab", { name: /criar conta/i });
  await signupTab.click();
  expect(await signupTab.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe("none");

  const nameField = page.getByPlaceholder("Como podemos chamar você?");
  await nameField.click();
  const focus = await nameField.evaluate((element) => {
    const style = getComputedStyle(element);
    return { border: style.borderColor, outline: style.outlineColor, shadow: style.boxShadow };
  });
  expect(focus.border).toBe("rgb(85, 125, 23)");
  expect(focus.outline).toBe("rgb(85, 125, 23)");
  expect(focus.shadow).not.toContain("rgb(0, 0, 0)");

  await page.goto("/");
  const searchField = page.getByLabel("O que você quer vender?");
  await searchField.click();
  const landingFocus = await searchField.evaluate((element) => {
    const style = getComputedStyle(element);
    return { outline: style.outlineColor, shadow: style.boxShadow };
  });
  expect(landingFocus.outline).toBe("rgb(85, 125, 23)");
  expect(landingFocus.shadow).not.toContain("rgb(0, 0, 0)");

  await page.keyboard.press("Tab");
  const keyboardFocus = await page.evaluate(() => {
    const element = document.activeElement!;
    const style = getComputedStyle(element);
    return { tag: element.tagName, outline: style.outlineColor, outlineStyle: style.outlineStyle };
  });
  expect(keyboardFocus.tag).toBe("BUTTON");
  expect(keyboardFocus.outline).toBe("rgb(85, 125, 23)");
  expect(keyboardFocus.outlineStyle).toBe("solid");
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
    await expect(page.getByRole("button", { name: /criar conta grátis/i })).toBeVisible();
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
