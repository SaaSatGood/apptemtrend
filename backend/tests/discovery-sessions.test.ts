import { describe, expect, it, beforeEach, vi } from 'vitest';

// Fila de respostas por tabela + auth.getUser falsificado: permite testar as
// rotas de sessão de ponta a ponta (requireAuth → requireActiveCreator → service).
const state = vi.hoisted(() => ({
  queues: new Map<string, unknown[]>(),
  getUser: { data: { user: { id: 'user-1', email: 'creator@example.com' } }, error: null },
}));

function queue(table: string, ...results: unknown[]) {
  const list = state.queues.get(table) ?? [];
  list.push(...results);
  state.queues.set(table, list);
}

function queueRow(table: string, row: unknown) {
  queue(table, { data: row, error: null });
}

vi.mock('../src/lib/supabase.js', () => ({
  supabaseAdmin: {
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      for (const name of ['select', 'insert', 'update', 'delete', 'eq', 'in', 'order', 'limit', 'range']) {
        chain[name] = () => chain;
      }
      const shift = (field: 'maybeSingle' | 'single' | 'then') => {
        const results = state.queues.get(table) ?? [];
        return results.shift() ?? { data: null, error: null };
      };
      chain.maybeSingle = () => shift('maybeSingle');
      chain.single = () => shift('single');
      chain.then = (resolve: (value: unknown) => unknown) => resolve(shift('then'));
      return chain;
    },
    auth: {
      getUser: (token: string) => {
        if (token === 'valid-token') return Promise.resolve(state.getUser);
        return Promise.resolve({ data: { user: null }, error: { message: 'invalid' } });
      },
    },
  },
}));

import { buildApp } from '../src/app.js';

const TOKEN = 'valid-token';
const authConfig = { headers: { authorization: `Bearer ${TOKEN}` } };

const turnSample = {
  query: 'Faixa elástica para treino',
  message: 'Encontrei 2 produtos para você.',
  products: [
    { id: '11111111-1111-4111-8111-111111111111', nome: 'Faixa elástica', preco_min_brl: 20 },
    { id: '22222222-2222-4222-8222-222222222222', nome: 'Roda de exercício', preco_min_brl: 30 },
  ],
  needs_clarification: false,
  image_name: null,
};

beforeEach(() => {
  state.queues.clear();
});

describe('rotas de sessão do Descobrir', () => {
  it('exige autenticação', async () => {
    const app = buildApp();
    const response = await app.inject({ method: 'GET', url: '/assistant/sessions' });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('POST /assistant/sessions cria a sessão da primeira busca', async () => {
    const app = buildApp();
    queueRow('creators', { id: 'creator-1', status: 'ativo' });
    queueRow('discovery_sessions', {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Faixa elástica para treino',
      context: 'discover',
      turns: [turnSample],
      created_at: '2026-10-28T12:00:00Z',
      updated_at: '2026-10-28T12:00:00Z',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/assistant/sessions',
      ...authConfig,
      payload: {
        title: 'Faixa elástica para treino',
        context: 'discover',
        turns: [turnSample],
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.session?.id).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(body.session?.turn_count).toBe(1);
    await app.close();
  });

  it('POST rejeita payload inválido (contexto desconhecido, turnos demais)', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/assistant/sessions',
      ...authConfig,
      payload: { context: 'outro', turns: [] },
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('GET /assistant/sessions lista as conversas do creator', async () => {
    const app = buildApp();
    queueRow('creators', { id: 'creator-1', status: 'ativo' });
    queueRow('discovery_sessions', [
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        title: 'Conversa 1',
        context: 'discover',
        turns: [turnSample],
        created_at: '2026-10-28T12:00:00Z',
        updated_at: '2026-10-28T12:00:00Z',
      },
    ]);

    const response = await app.inject({ method: 'GET', url: '/assistant/sessions', ...authConfig });

    expect(response.statusCode).toBe(200);
    expect(response.json().items).toHaveLength(1);
    expect(response.json().items[0]).toMatchObject({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Conversa 1',
      turn_count: 1,
    });
    await app.close();
  });

  it('GET /assistant/sessions deriva o título da primeira mensagem quando o salvo é genérico', async () => {
    const app = buildApp();
    queueRow('creators', { id: 'creator-1', status: 'ativo' });
    queueRow('discovery_sessions', [
      {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        title: 'Conversa de 30/10',
        context: 'discover',
        turns: [
          { ...turnSample, query: 'oi' },
          { ...turnSample, query: 'Quero produtos para casa com preço de até 50 reais' },
        ],
        created_at: '2026-10-30T12:00:00Z',
        updated_at: '2026-10-30T12:00:00Z',
      },
      {
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        title: 'Minha casa',
        context: 'discover',
        turns: [turnSample],
        created_at: '2026-10-29T12:00:00Z',
        updated_at: '2026-10-29T12:00:00Z',
      },
    ]);

    const response = await app.inject({ method: 'GET', url: '/assistant/sessions', ...authConfig });

    expect(response.statusCode).toBe(200);
    expect(response.json().items[0].title).toBe('Quero produtos para casa com preço de até 50');
    expect(response.json().items[1].title).toBe('Minha casa');
    await app.close();
  });

  it('GET /assistant/sessions/:id devolve a conversa completa', async () => {
    const app = buildApp();
    queueRow('creators', { id: 'creator-1', status: 'ativo' });
    queueRow('discovery_sessions', {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Conversa 1',
      context: 'discover',
      turns: [turnSample],
      created_at: '2026-10-28T12:00:00Z',
      updated_at: '2026-10-28T12:00:00Z',
    });

    const response = await app.inject({
      method: 'GET',
      url: '/assistant/sessions/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      ...authConfig,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().session?.turns?.[0]?.query).toBe('Faixa elástica para treino');
    await app.close();
  });

  it('PATCH /assistant/sessions/:id salva o turno novo', async () => {
    const app = buildApp();
    queueRow('creators', { id: 'creator-1', status: 'ativo' });
    queueRow('discovery_sessions', {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Faixa elástica para treino',
      context: 'discover',
      turns: [turnSample],
      created_at: '2026-10-28T12:00:00Z',
      updated_at: '2026-10-28T12:01:00Z',
    });

    const response = await app.inject({
      method: 'PATCH',
      url: '/assistant/sessions/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      ...authConfig,
      payload: { turns: [turnSample] },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().session?.turn_count).toBe(1);
    await app.close();
  });

  it('sessão de outro creator não é devolvida nem atualizada', async () => {
    const app = buildApp();
    queueRow('creators', { id: 'creator-1', status: 'ativo' });
    queueRow('discovery_sessions', null);

    const response = await app.inject({
      method: 'GET',
      url: '/assistant/sessions/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      ...authConfig,
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });
});
