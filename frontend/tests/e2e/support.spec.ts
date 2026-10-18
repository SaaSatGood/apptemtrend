import { expect, test, type Page } from "@playwright/test";

// Fixtures isoladas: nada aqui toca serviços reais.
const userId = "11111111-1111-4111-8111-111111111111";
const ticketId = "bbbb2222-2222-4222-8222-222222222222";
const createdTicketId = "cccc3333-3333-4333-8333-333333333333";
const nowIso = "2026-10-18T10:00:00.000Z";

interface TicketFixture {
  id: string;
  subject: string;
  category: string;
  status: string;
  last_message_at: string;
  created_at: string;
}

interface MessageFixture {
  id: string;
  author: "creator" | "support";
  body: string;
  created_at: string;
}

async function withSession(page: Page) {
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
}

function setupApi(page: Page, options: { tickets: TicketFixture[]; messages: Record<string, MessageFixture[]> }) {
  let list = [...options.tickets];
  const messages = { ...options.messages };
  const tracker = { createBody: null as unknown, replyBody: null as unknown, closedIds: [] as string[], replyStatus: "open" };
  let messageSeq = 100;

  return page.route("http://localhost:3333/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const method = req.method();

    if (path === "/me") {
      return route.fulfill({
        json: {
          user_id: userId,
          creator: { id: userId, estilos_conteudo: [], temas_interesse: [] },
          onboarding_completo: true,
          is_admin: false,
        },
      });
    }
    if (path === "/creator-content") return route.fulfill({ json: [] });

    if (path === "/support/tickets" && method === "GET") {
      return route.fulfill({ json: { items: list } });
    }
    if (path === "/support/tickets" && method === "POST") {
      const body = req.postDataJSON() as { subject: string; category: string; message: string };
      tracker.createBody = body;
      const created: TicketFixture = {
        id: createdTicketId,
        subject: body.subject,
        category: body.category,
        status: "open",
        last_message_at: nowIso,
        created_at: nowIso,
      };
      list = [created, ...list];
      messages[created.id] = [{ id: "m1", author: "creator", body: body.message, created_at: nowIso }];
      return route.fulfill({ status: 201, json: created });
    }

    const match = path.match(/^\/support\/tickets\/([^/]+)(\/(messages|close))?$/);
    if (match) {
      const id = match[1];
      const action = match[3];
      if (method === "GET" && !action) {
        const ticket = list.find((item) => item.id === id);
        if (!ticket) return route.fulfill({ status: 404, json: { error: { message: "Conversa não encontrada." } } });
        return route.fulfill({ json: { ...ticket, messages: messages[id] ?? [] } });
      }
      if (method === "POST" && action === "messages") {
        const body = req.postDataJSON() as { body: string };
        tracker.replyBody = body;
        const message: MessageFixture = {
          id: `m${++messageSeq}`,
          author: "creator",
          body: body.body,
          created_at: nowIso,
        };
        messages[id] = [...(messages[id] ?? []), message];
        list = list.map((item) => (item.id === id ? { ...item, status: tracker.replyStatus, last_message_at: nowIso } : item));
        return route.fulfill({ json: { status: tracker.replyStatus, message } });
      }
      if (method === "POST" && action === "close") {
        tracker.closedIds.push(id);
        list = list.map((item) => (item.id === id ? { ...item, status: "closed" } : item));
        return route.fulfill({ json: { ok: true, status: "closed" } });
      }
    }

    return route.fulfill({ status: 404, json: { error: { message: `Unmocked: ${method} ${path}` } } });
  }).then(() => tracker);
}

test("suporte: creator abre conversa, responde e encerra", async ({ page }) => {
  await withSession(page);
  const tracker = await setupApi(page, { tickets: [], messages: {} });

  await page.goto("/app/suporte");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Conte com a gente");
  await expect(page.getByText("Nenhuma conversa ainda. Quando precisar, clique em “Nova conversa”.")).toBeVisible();

  await page.getByRole("button", { name: "Nova conversa" }).click();
  await page.getByLabel("Assunto").fill("Não consigo buscar produtos");
  await page.getByLabel("Categoria").selectOption("problema");
  await page.getByLabel("Descreva o que está acontecendo").fill("A busca fica girando e volta vazia.");
  await page.getByRole("button", { name: "Enviar mensagem" }).click();

  await expect(page.getByRole("heading", { name: "Não consigo buscar produtos" })).toBeVisible();
  await expect(page.getByText("A busca fica girando e volta vazia.")).toBeVisible();
  expect(tracker.createBody).toEqual({
    subject: "Não consigo buscar produtos",
    category: "problema",
    message: "A busca fica girando e volta vazia.",
  });

  await page.getByLabel("Sua mensagem").fill("Alguma novidade sobre o meu caso?");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.getByText("Alguma novidade sobre o meu caso?")).toBeVisible();
  expect(tracker.replyBody).toEqual({ body: "Alguma novidade sobre o meu caso?" });
  await expect(page.getByText("Aguardando suporte").first()).toBeVisible();

  await page.getByRole("button", { name: "Encerrar conversa" }).click();
  await expect(page.getByText("Esta conversa foi encerrada. Para um novo assunto, abra outra conversa.")).toBeVisible();
  expect(tracker.closedIds).toEqual([createdTicketId]);
});

test("suporte: conversa respondida mostra o histórico e volta para a fila", async ({ page }) => {
  await withSession(page);
  const tracker = await setupApi(page, {
    tickets: [
      {
        id: ticketId,
        subject: "Dúvida sobre roteiro",
        category: "duvida",
        status: "answered",
        last_message_at: nowIso,
        created_at: nowIso,
      },
    ],
    messages: {
      [ticketId]: [
        { id: "m1", author: "creator", body: "Como gero o roteiro de um produto?", created_at: nowIso },
        { id: "m2", author: "support", body: "Olá! Já verificamos e o roteiro saiu — confere pra mim?", created_at: nowIso },
      ],
    },
  });

  await page.goto("/app/suporte");
  await page.getByRole("button", { name: /Dúvida sobre roteiro/ }).click();
  await expect(page.getByText("Olá! Já verificamos e o roteiro saiu — confere pra mim?")).toBeVisible();
  await expect(page.getByText("Respondido").first()).toBeVisible();

  await page.getByLabel("Sua mensagem").fill("Deu certo, obrigado!");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.getByText("Deu certo, obrigado!")).toBeVisible();
  await expect(page.getByText("Aguardando suporte").first()).toBeVisible();
  expect(tracker.replyBody).toEqual({ body: "Deu certo, obrigado!" });
});
