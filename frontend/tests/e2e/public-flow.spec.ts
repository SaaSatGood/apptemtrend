import { expect, test } from "@playwright/test";

test("landing apresenta a proposta e leva ao cadastro", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/TemTrend/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("link", { name: /começar agora/i }).first().click();
  await expect(page).toHaveURL(/\/app\/descobrir\?mode=signup/);
  await expect(page.getByRole("heading", { name: /comece a vender/i })).toBeVisible();
});

test("hero mantém produto real e busca legível no celular", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: /Do produto ao vídeo/ })).toBeVisible();
  const image = page.locator(".tt-lp-product-thumb");
  await expect(image).toHaveAttribute("src", /hero-tumbler-v2/);
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator(".tt-lp-product-info strong")).toContainText("Garrafa térmica");
  const search = page.getByLabel("O que você quer vender?");
  const searchFont = await search.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  expect(searchFont).toBeGreaterThanOrEqual(15);
  const submit = page.getByRole("button", { name: /Encontrar produtos/ });
  const submitBox = await submit.boundingBox();
  expect(submitBox!.width).toBeGreaterThanOrEqual(240);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("artes renascentistas mostram o telefone nos três passos sem criar rolagem lateral", async ({ page }) => {
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const section = page.locator("#como-funciona");
    await expect(section.getByRole("heading", { name: "Três passos para gravar." })).toBeVisible();
    for (const image of [section.locator(".tt-lp-steps-hand-left"), section.locator(".tt-lp-steps-hand-right")]) {
      await expect(image).toBeVisible();
      await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
    }
    await expect(section.locator(".tt-lp-steps-hand-right")).toHaveAttribute("src", /renaissance-phone-hand/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});

test("demo do plano alterna exemplos e mantém as três cenas acessíveis", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const tabs = page.getByRole("tab");
  await expect(tabs).toHaveCount(3);
  await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
  const panel = page.getByRole("tabpanel");
  await expect(panel).toContainText("Garrafa térmica");
  await expect(panel.locator(".tt-lp-plan-scenes li")).toHaveCount(3);
  await expect(panel.locator(".tt-lp-plan-parts span")).toHaveCount(5);

  await page.getByRole("tab", { name: "Beleza" }).click();
  await expect(page.getByRole("tab", { name: "Beleza" })).toHaveAttribute("aria-selected", "true");
  await expect(panel).toContainText("Escova facial");
  await expect(panel.locator(".tt-lp-plan-scenes li")).toHaveCount(3);

  await page.getByRole("tab", { name: "Beleza" }).press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Tech" })).toBeFocused();
  await expect(page.getByRole("tab", { name: "Tech" })).toHaveAttribute("aria-selected", "true");
  await expect(panel).toContainText("Fone sem fio");

  await page.setViewportSize({ width: 390, height: 844 });
  const tabBoxes = await tabs.evaluateAll((elements) => elements.map((element) => {
    const box = element.getBoundingClientRect();
    return { left: box.left, right: box.right };
  }));
  expect(tabBoxes.every((box) => box.left >= 0 && box.right <= 390)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("revelação progressiva mostra o conteúdo ao rolar e respeita menos movimento", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".tt-home.tt-lp.tt-lp-reveal-ready")).toHaveCount(1);
  const reveals = page.locator("[data-reveal]");
  expect(await reveals.count()).toBeGreaterThan(10);
  for (const reveal of await reveals.all()) {
    await reveal.scrollIntoViewIfNeeded();
    await expect(reveal).toHaveClass(/is-visible/);
  }
  await expect(page.getByRole("heading", { name: /Três passos/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Comece grátis/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Grátis", exact: true })).toBeVisible();
  await expect(page.getByText(/não é afiliada, patrocinada/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /reproduzir|play/i })).toHaveCount(0);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(page.locator(".tt-lp.tt-lp-reveal-ready")).toHaveCount(0);
  const hidden = await page.locator("[data-reveal]").evaluateAll((elements) =>
    elements.filter((element) => getComputedStyle(element).opacity === "0").length
  );
  expect(hidden).toBe(0);
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

test("tipografia compartilhada usa Poppins nos títulos e Inter Tight na leitura", async ({ page }) => {
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
    expect(fonts.heading).toContain("Poppins");
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
