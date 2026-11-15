import { expect, test, type Page } from "@playwright/test";

// Cenário isolado (fixtures, nunca chamadas reais): valida o ciclo completo do
// histórico de conversas do Descobrir → criação de sessão na primeira busca,
// item na sidebar, reabertura e tela inicial ao clicar em "Descobrir".
const userId = "11111111-1111-4111-8111-111111111111";
const sessionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const productId = "33333333-3333-4333-8333-333333333333";
const product = {
  id: productId,
  nome: "Organizador de cozinha",
  categoria: "Casa e cozinha",
  preco_texto: "R$ 29,90",
  preco_min_brl: 29.9,
  unidades_vendidas_periodo: 125,
  imagem_url: "/temtrend-mark.svg",
  descricao: "Organize seus utensílios e deixe a bancada livre.",
  tiktok_shop_url: "https://www.tiktok.com/",
};

async function setup(page: Page, opts: { savedSessions?: Array<{ id: string; title: string; context: string; turns: unknown[]; created_at: string; updated_at: string }> } = {}) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: userId, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.signature`;
  await page.addInitScript(({ token, userId }) => {
    (window as unknown as { __TT_E2E_SESSION__?: unknown }).__TT_E2E_SESSION__ = {
      access_token: token,
      refresh_token: "fixture",
      user: { id: userId, email: "creator@temtrend.test" },
    };
  }, { token, userId });
  await page.route("**/auth/v1/**", (route) => route.fulfill({ json: { id: userId, email: "creator@temtrend.test", user_metadata: { full_name: "Rafa" } } }));

  const savedSessions = opts.savedSessions ?? [];
  const sessionTurns: Array<{ turns: unknown[]; title: string; context: string }> = [];
  const sessionCalls: string[] = [];
  const createdSessions: Array<{ id: string; title: string; context: string; turns: unknown[]; created_at: string; updated_at: string }> = [];

  await page.route("**/assistant/sessions**", async (route) => {
    const req = route.request();
    const method = req.method();
    sessionCalls.push(`${method} ${new URL(req.url()).pathname}`);
    if (method === "GET") {
      return route.fulfill({
        json: {
          items: [...createdSessions, ...savedSessions].map((session) => ({ ...session, turn_count: session.turns.length })),
        },
      });
    }
    if (method === "POST") {
      const body = req.postDataJSON();
      sessionTurns.push({ turns: body.turns, title: body.title, context: body.context });
      const created = {
        id: sessionId,
        title: body.title,
        context: body.context,
        turns: body.turns ?? [],
        created_at: "2026-10-28T12:00:00Z",
        updated_at: "2026-10-28T12:00:00Z",
      };
      createdSessions.unshift(created);
      return route.fulfill({
        json: {
          session: {
            id: created.id,
            title: created.title,
            context: created.context,
            turn_count: created.turns.length,
            created_at: created.created_at,
            updated_at: created.updated_at,
          },
        },
      });
    }
    if (method === "PATCH") {
      const body = req.postDataJSON();
      sessionTurns.push({ turns: body.turns, title: savedSessions[0]?.title ?? "", context: "discover" });
      return route.fulfill({
        json: {
          session: {
            id: sessionId,
            title: savedSessions[0]?.title ?? "Conversa",
            context: "discover",
            turn_count: (body.turns ?? []).length,
            created_at: "2026-10-28T12:00:00Z",
            updated_at: "2026-10-28T12:01:00Z",
          },
        },
      });
    }
    return route.fulfill({ json: { deleted: true } });
  });

  await page.route("**/assistant/sessions/yyyyyyyy-aaaa-4aaa-8aaa-aaaaaaaaaaaa", async (route) => {
    return route.fulfill({
      json: {
        session: {
          id: "yyyyyyyy-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          title: "Produtos para organizing",
          context: "discover",
          turn_count: 2,
          turns: [
            {
              query: "Produtos para organizing",
              message: "Encontrei 1 produto.",
              products: [product],
              needs_clarification: false,
              image_name: null,
            },
            {
              query: "Me mostre algo mais barato",
              message: "Este organizador é a melhor opção.",
              products: [product],
              needs_clarification: false,
              image_name: null,
            },
          ],
          created_at: "2026-10-28T12:00:00Z",
          updated_at: "2026-10-28T12:01:00Z",
        },
      },
    });
  });

  await page.route("http://localhost:3333/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const method = req.method();
    // Este catch-all é registrado depois das rotas de sessão e, por isso,
    // teria prioridade sobre elas: devolve a chamada para o mock específico.
    if (path.startsWith("/assistant/sessions")) return route.fallback();
    if (path === "/me") return route.fulfill({ json: { user_id: userId, creator: { id: userId, estilos_conteudo: [], temas_interesse: [] }, onboarding_completo: true, is_admin: false } });
    if (path === "/assistant/searches" && method === "GET") return route.fulfill({ json: { items: [] } });
    if (path.startsWith("/assistant/searches/")) return route.fulfill({ json: {} });
    if (path === "/assistant/products" && method === "POST") return route.fulfill({ json: { message: "Encontrei 1 produto.", products: [product], needs_clarification: false } });
    if (path === "/products" ) return route.fulfill({ json: [product] });
    if (path === "/billing/subscription") return route.fulfill({ json: { plan: "free", limits: {} } });
    if (path === "/creator-content" && method === "GET") return route.fulfill({ json: [] });
    return route.fulfill({ json: {} });
  });

  return { sessionCalls, sessionTurns };
}

test("busca cria sessão, muda a URL e aparece no histórico da sidebar", async ({ page }) => {
  const { sessionCalls } = await setup(page);
  await page.goto("/descobrir");

  const input = page.locator("#assistant-input");
  await expect(input).toBeVisible();
  await input.fill("Organizador de cozinha");
  await page.getByRole("button", { name: "Encontrar produtos" }).click();

  // A resposta aparece e a URL vira /descobrir/{id}
  await expect(page.getByText("Encontrei 1 produto.")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/descobrir/${sessionId}$`));

  // POST /assistant/sessions foi disparado no primeiro turno
  expect(sessionCalls).toContain("POST /assistant/sessions");

  // Sidebar lista a conversa criada
  const historyItem = page.locator(".tt-rail-history-item").first();
  await expect(historyItem).toBeVisible();
});

test("abrir uma conversa mostra o chat, nunca o palco inicial", async ({ page }) => {
  await setup(page, {
    savedSessions: [{
      id: "yyyyyyyy-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      title: "Produtos para organizing",
      context: "discover",
      turns: [],
      created_at: "2026-10-28T12:00:00Z",
      updated_at: "2026-10-28T12:01:00Z",
    }],
  });
  // Atraso artificial: o esqueleto do chat precisa aparecer no lugar do palco.
  await page.route("**/assistant/sessions/yyyyyyyy-aaaa-4aaa-8aaa-aaaaaaaaaaaa", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    return route.fallback();
  });
  await page.goto("/descobrir");

  const historyItem = page.locator(".tt-rail-history-item", { hasText: "Produtos para organizing" }).first();
  await expect(historyItem).toBeVisible();
  await historyItem.click();

  await expect(page).toHaveURL(/\/descobrir\/yyyyyyyy-aaaa-4aaa-8aaa-aaaaaaaaaaaa$/);
  await expect(page.locator(".discovery-hero")).toHaveCount(0);
  await expect(page.locator(".chat-skeleton")).toBeVisible();
  await expect(page.locator(".chat-turn.is-current")).toBeVisible({ timeout: 5000 });
  await expect(page.locator(".chat-skeleton")).toHaveCount(0);
});

test("reabrir a conversa pelo histórico restaura o chat inteiro", async ({ page }) => {
  await setup(page, {
    savedSessions: [{
      id: "yyyyyyyy-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      title: "Produtos para organizing",
      context: "discover",
      turns: [],
      created_at: "2026-10-28T12:00:00Z",
      updated_at: "2026-10-28T12:01:00Z",
    }],
  });
  await page.goto("/descobrir");

  const historyItem = page.locator(".tt-rail-history-item", { hasText: "Produtos para organizing" }).first();
  await expect(historyItem).toBeVisible();
  await historyItem.click();

  // URL muda para a sessão e a conversa inteira é restaurada
  await expect(page).toHaveURL(new RegExp(`/descobrir/yyyyyyyy-aaaa-4aaa-8aaa-aaaaaaaaaaaa$`));
  await expect(page.locator(".chat-turn.is-past", { hasText: "Produtos para organizing" })).toBeVisible();
  await expect(page.locator(".chat-turn.is-current", { hasText: "Este organizador é a melhor opção." })).toBeVisible();
  await expect(page.getByText("Encontrei 1 produto.")).toBeVisible();
});

test("clicar em Descobrir abre a tela inicial do Descobrir (chat novo)", async ({ page }) => {
  await setup(page, {
    savedSessions: [{
      id: "yyyyyyyy-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      title: "Produtos para organizing",
      context: "discover",
      turns: [],
      created_at: "2026-10-28T12:00:00Z",
      updated_at: "2026-10-28T12:01:00Z",
    }],
  });
  await page.goto("/descobrir");

  // Histórico aparece
  await expect(page.locator(".tt-rail-history-item").first()).toBeVisible();

  // Clicar em Descobrir → tela inicial com o compositor vazio
  await page.getByRole("link", { name: "Descobrir", exact: true }).click();
  await expect(page).toHaveURL(/\/descobrir\?nova=\d+$/);
  await expect(page.locator("#assistant-input")).toBeVisible();
  await expect(page.locator("#assistant-input")).toHaveValue("");
  // A conversa anterior não é restaurada
  await expect(page.locator(".chat-turn")).toHaveCount(0);
});
