import { expect, test } from "@playwright/test";

const userId = "11111111-1111-4111-8111-111111111111";
const ids = Array.from({ length: 7 }, (_, index) => `33333333-3333-4333-8333-${String(index + 1).padStart(12, "0")}`);
const products = ids.map((id, index) => ({ id, nome: `Produto editorial ${index + 1}`, categoria: "Casa", imagem_url: "", preco_texto: "R$ 29,90" }));

test("planeja sete conteúdos e os mostra nas duas áreas", async ({ page }) => {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: userId, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.signature`;
  await page.addInitScript(({ token, userId }) => {
    (window as unknown as { __TT_E2E_SESSION__?: unknown }).__TT_E2E_SESSION__ = { access_token: token, refresh_token: "fixture", user: { id: userId, email: "creator@temtrend.test" } };
  }, { token, userId });

  const contents: Array<Record<string, unknown>> = [];
  const kits = new Map<string, Record<string, unknown>>();
  const scheduled: string[] = [];
  await page.route("**/auth/v1/**", (route) => route.fulfill({ json: { id: userId, email: "creator@temtrend.test" } }));
  await page.route("http://localhost:3333/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    if (path === "/health") return route.fulfill({ json: { ok: true } });
    if (path === "/me") return route.fulfill({ json: { user_id: userId, creator: { id: userId, plan: "pro", plan_status: "active" }, onboarding_completo: true, is_admin: false } });
    if (path === "/assistant/searches") return route.fulfill({ json: { items: [] } });
    if (path === "/assistant/products") return route.fulfill({ json: { message: "Estou preparando sua semana.", products, weekly_plan_requested: true } });
    if (path === "/products") return route.fulfill({ json: products });
    if (path === "/billing/subscription") return route.fulfill({ json: { plan: "pro", limits: { productionItems: null } } });
    if (path === "/creator-content" && method === "GET") return route.fulfill({ json: contents });
    if (path === "/creator-content" && method === "POST") {
      const productId = request.postDataJSON().product_id as string;
      const index = ids.indexOf(productId);
      const content = {
        id: `55555555-5555-4555-8555-${String(index + 1).padStart(12, "0")}`,
        creator_id: userId, product_id: productId, content_kit_id: kits.get(productId)?.id,
        status: "salvo", products: products[index], content_kits: kits.get(productId), scheduled_for: null,
      };
      contents.push(content);
      return route.fulfill({ json: content });
    }
    if (path.endsWith("/content-kit") && method === "POST") {
      const productId = path.split("/")[2];
      const index = ids.indexOf(productId);
      const kit = { id: `44444444-4444-4444-8444-${String(index + 1).padStart(12, "0")}`, product_id: productId, titulo: `Roteiro ${index + 1}`, hook: `Gancho ${index + 1}`, roteiro: `Texto completo ${index + 1}`, copy: `Legenda ${index + 1}`, cta: "Confira o produto", hashtags: ["#achadinhos", "#casa"] };
      kits.set(productId, kit);
      return route.fulfill({ json: { content_kit: kit, created: true } });
    }
    if (path.startsWith("/creator-content/") && method === "PATCH") {
      const content = contents.find((item) => item.id === path.split("/")[2]);
      if (!content) return route.fulfill({ status: 404, json: { error: { message: "Conteúdo não encontrado" } } });
      const date = request.postDataJSON().scheduled_for as string;
      content.scheduled_for = date;
      scheduled.push(date);
      return route.fulfill({ json: content });
    }
    return route.fulfill({ status: 404, json: { error: { message: `Unmocked: ${path}` } } });
  });

  await page.goto("/descobrir?plan=week");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".tt-weekly-day select")).toHaveCount(7);
  // Mesma regra do Dashboard: a "próxima semana" começa na próxima segunda
  // (ou hoje, se hoje for segunda). Datas fixas quebravam o teste com o tempo.
  const weekStart = (() => {
    const today = new Date();
    const offset = (8 - today.getDay()) % 7;
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
  })();
  await page.locator("#tt-weekly-date").fill(weekStart);
  await expect(page.locator(".tt-weekly-day").first()).toContainText("Segunda");
  expect(await page.locator(".tt-weekly-dialog").evaluate((element) => element.getBoundingClientRect().right)).toBeLessThanOrEqual(390);
  await expect(page.getByRole("button", { name: "Preparar 7 dias" })).toBeEnabled();
  await page.getByRole("button", { name: "Preparar 7 dias" }).click();
  await expect(page.getByText("7 dias preparados.")).toBeVisible();
  expect(scheduled).toHaveLength(7);
  expect(new Set(scheduled).size).toBe(7);

  await page.goto("/descobrir");
  await expect(page.getByRole("heading", { name: /Encontre|Sua próxima|oportunidade/i }).first()).toBeVisible();

  await page.goto("/conteudos");
  await expect(page.locator(".ct-row")).toHaveCount(7);
  // Cada linha agendada mostra a data em um chip editável.
  await expect(page.locator(".ct-row .ct-date-chip").first()).toContainText("/");
  await page.goto("/calendario");
  await expect(page.locator(".tt-calendar-item-badge")).toHaveCount(7);
  await page.reload();
  await expect(page.locator(".tt-calendar-item-badge")).toHaveCount(7);
  await page.goto("/conteudos");
  // Remove o agendamento da primeira linha; a lista reordena por data, então
  // validamos a contagem de chips vazios, não a posição.
  const firstRow = page.locator(".ct-row").first();
  await firstRow.locator(".ct-date-chip").click();
  await firstRow.locator("input[type=date]").fill("");
  await firstRow.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.locator(".ct-row .ct-date-chip.is-empty")).toHaveCount(1);
  await page.goto("/calendario");
  await expect(page.locator(".tt-calendar-item-badge")).toHaveCount(6);

  await page.goto("/descobrir");
  await page.getByLabel("O que você quer vender?").fill("Quero conteúdo para a semana toda com produtos, roteiros e hashtags");
  await page.locator(".assistant-send-button").click();
  await expect(page.locator(".discovery-week-plan-day")).toHaveCount(7);
  await expect(page.locator(".discovery-week-plan-day").first()).toContainText("Texto completo 1");
  await expect(page.locator(".discovery-week-plan-day").first()).toContainText("#achadinhos");
  await expect(page.getByText("7 de 7 dias preparados.")).toBeVisible();
  const finalDates = contents.map((item) => item.scheduled_for).filter(Boolean);
  expect(finalDates).toHaveLength(7);
  expect(new Set(finalDates).size).toBe(7);
});
