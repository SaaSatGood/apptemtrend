import { describe, expect, it, vi, beforeEach } from 'vitest';

type Op = [string, ...unknown[]];
interface Call { table: string; ops: Op[] }
interface Terminal { data?: unknown; error?: unknown; count?: number }

const state = vi.hoisted(() => ({
  calls: [] as Call[],
  responses: [] as Terminal[],
}));

function push(...results: Terminal[]) {
  state.responses.push(...results);
}

function callsFor(table: string): Call[] {
  return state.calls.filter((call) => call.table === table);
}

vi.mock('../src/lib/supabase.js', () => ({
  supabaseAdmin: {
    from: (table: string) => {
      const call: Call = { table, ops: [] };
      state.calls.push(call);
      const chain: Record<string, unknown> = {};
      for (const name of ['select', 'insert', 'update', 'delete', 'eq', 'in', 'order', 'limit', 'range']) {
        chain[name] = (...args: unknown[]) => {
          call.ops.push([name, ...args]);
          return chain;
        };
      }
      chain.maybeSingle = async () => state.responses.shift() ?? { data: null, error: null };
      chain.single = async () => state.responses.shift() ?? { data: null, error: null };
      chain.then = (resolve: (value: Terminal) => unknown) => resolve(state.responses.shift() ?? { data: null, error: null });
      return chain;
    },
  },
}));

const assertKitQuota = vi.hoisted(() => vi.fn(async () => {}));
const createContentKit = vi.hoisted(() => vi.fn(async () => ({ id: 'copy-1', product_id: 'p1', titulo: 'Roteiro' })));

vi.mock('../src/modules/billing/billing.gating.js', () => ({ assertKitQuota }));
vi.mock('../src/modules/content-kits/content-kit.repository.js', () => ({ createContentKit }));

import {
  createSharedConversation,
  getSharedConversation,
  importSharedKit,
  listSharedConversations,
  revokeSharedConversation,
  shareUrlPath,
} from '../src/modules/share/share.service.js';
import type { Creator } from '../src/types/index.js';

const viewer = { id: 'viewer-creator', user_id: 'u1' } as Creator;
const turn = {
  query: 'quero um produto para praia',
  message: 'Encontrei 1 produto para você.',
  products: [{ id: 'p1', nome: 'Bolsa de praia', preco_texto: 'R$ 59,90', motivo: 'Combina com sua busca' }],
  needs_clarification: false,
  image_name: null,
};

beforeEach(() => {
  state.calls.length = 0;
  state.responses.length = 0;
  assertKitQuota.mockClear();
  createContentKit.mockClear();
});

describe('createSharedConversation', () => {
  it('insere a conversa com slug, turnos e contagens', async () => {
    push({ data: { id: 's1', slug: 'abc123XYZ_-', title: 'quero um produto para praia', turn_count: 1, product_count: 1, criado_em: '2026-10-28T10:00:00Z' }, error: null });
    push({ data: [], error: null }); // poda

    const result = await createSharedConversation({ creatorId: 'c1', userId: 'u1', turns: [turn] });

    expect(result.slug).toBe('abc123XYZ_-');
    expect(shareUrlPath(result.slug)).toBe(`/compartilhar/${result.slug}`);
    const insert = callsFor('shared_conversations').find((call) => call.ops.some((op) => op[0] === 'insert'));
    expect(insert).toBeTruthy();
    const payload = insert?.ops.find((op) => op[0] === 'insert')?.[1] as Record<string, unknown>;
    expect(payload).toMatchObject({
      creator_id: 'c1',
      user_id: 'u1',
      title: 'quero um produto para praia',
      turn_count: 1,
      product_count: 1,
    });
    expect(String(payload.slug)).toMatch(/^[A-Za-z0-9_-]{8,32}$/);
  });

  it('usa o título enviado quando existe', async () => {
    push({ data: { id: 's1', slug: 'slug12345678', title: 'Semana de praia', turn_count: 1, product_count: 1, criado_em: '2026-10-28T10:00:00Z' }, error: null });
    push({ data: [], error: null });

    const result = await createSharedConversation({ creatorId: 'c1', userId: 'u1', title: 'Semana de praia', turns: [turn] });
    expect(result.title).toBe('Semana de praia');
  });
});

describe('listSharedConversations', () => {
  it('lista só os links ativos do creator', async () => {
    push({ data: [{ id: 's1', slug: 'slug-1', title: 't', turn_count: 1, product_count: 1, criado_em: '2026-10-28T10:00:00Z' }], error: null });

    const items = await listSharedConversations('c1');
    expect(items).toHaveLength(1);
    const call = callsFor('shared_conversations')[0];
    expect(call.ops).toContainEqual(['eq', 'revoked', false]);
    expect(call.ops).toContainEqual(['eq', 'creator_id', 'c1']);
  });
});

describe('getSharedConversation', () => {
  const row = {
    id: 's1',
    slug: 'slug-1',
    creator_id: 'owner-creator',
    user_id: 'u1',
    title: 'quero um produto para praia',
    turns: [turn],
    turn_count: 1,
    product_count: 1,
    revoked: false,
    criado_em: '2026-10-28T10:00:00Z',
  };

  it('re-hidrata o produto do catálogo e anexa os roteiros do dono', async () => {
    push({ data: row, error: null }); // linha do link
    push({ data: [{ id: 'p1', nome: 'Bolsa de praia', preco_texto: 'R$ 59,90', categoria: 'Praia' }], error: null }); // produtos
    push({ data: [{ id: 'k1', product_id: 'p1', titulo: 'Roteiro da bolsa' }], error: null }); // kits do dono

    const conversation = await getSharedConversation('slug-1', 'outra-conta');

    expect(conversation.is_owner).toBe(false);
    expect(conversation.turns[0].products[0]).toMatchObject({
      id: 'p1',
      nome: 'Bolsa de praia',
      categoria: 'Praia',
      motivo: 'Combina com sua busca',
    });
    expect((conversation.turns[0].products[0] as { content_kits: unknown[] }).content_kits).toHaveLength(1);
    const kitsCall = callsFor('content_kits')[0];
    expect(kitsCall.ops).toContainEqual(['eq', 'creator_id', 'owner-creator']);
    expect(kitsCall.ops).toContainEqual(['in', 'product_id', ['p1']]);
  });

  it('marca is_owner quando quem abre é o dono do link', async () => {
    push({ data: row, error: null });
    push({ data: [], error: null });
    push({ data: [], error: null });

    const conversation = await getSharedConversation('slug-1', 'owner-creator');
    expect(conversation.is_owner).toBe(true);
  });

  it('responde 404 para link inexistente ou revogado', async () => {
    push({ data: null, error: null });
    await expect(getSharedConversation('nao-existe', 'c1')).rejects.toMatchObject({ statusCode: 404 });

    push({ data: { ...row, revoked: true }, error: null });
    await expect(getSharedConversation('slug-1', 'c1')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('importSharedKit', () => {
  const row = {
    id: 's1',
    slug: 'slug-1',
    creator_id: 'owner-creator',
    user_id: 'u1',
    title: 'praia',
    turns: [],
    turn_count: 1,
    product_count: 1,
    revoked: false,
    criado_em: '2026-10-28T10:00:00Z',
  };
  const sourceKit = { id: 'k1', product_id: 'p1', creator_id: 'owner-creator', titulo: 'Roteiro da bolsa', briefing_usuario: 'sem rosto' };

  it('devolve o próprio roteiro quando quem abre é o dono', async () => {
    push({ data: row, error: null });
    push({ data: sourceKit, error: null });

    const result = await importSharedKit({ slug: 'slug-1', viewer: { id: 'owner-creator', user_id: 'u1' } as Creator, productId: 'p1' });

    expect(result.created).toBe(false);
    expect(result.content_kit.id).toBe('k1');
    expect(createContentKit).not.toHaveBeenCalled();
  });

  it('copia o roteiro do dono para o workspace de quem recebe o link', async () => {
    push({ data: row, error: null });
    push({ data: sourceKit, error: null }); // roteiro de origem
    push({ data: null, error: null }); // ainda não copiado

    const result = await importSharedKit({ slug: 'slug-1', viewer, productId: 'p1' });

    expect(result.created).toBe(true);
    expect(createContentKit).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ titulo: 'Roteiro da bolsa', source_kit_id: 'k1' }),
      expect.objectContaining({ creatorId: 'viewer-creator', usouVoz: false }),
    );
  });

  it('reutiliza a cópia anterior em vez de duplicar o roteiro', async () => {
    push({ data: row, error: null });
    push({ data: sourceKit, error: null });
    push({ data: { id: 'copy-9' }, error: null }); // cópia existente
    push({ data: { id: 'copy-9', product_id: 'p1', titulo: 'Roteiro da bolsa' }, error: null });

    const result = await importSharedKit({ slug: 'slug-1', viewer, productId: 'p1' });

    expect(result.created).toBe(false);
    expect(result.content_kit.id).toBe('copy-9');
    expect(createContentKit).not.toHaveBeenCalled();
    expect(assertKitQuota).not.toHaveBeenCalled();
  });

  it('404 quando o link não tem roteiro para o produto', async () => {
    push({ data: row, error: null });
    push({ data: null, error: null });

    await expect(importSharedKit({ slug: 'slug-1', viewer, productId: 'p9' })).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('revokeSharedConversation', () => {
  it('desativa o link apenas do próprio creator', async () => {
    push({ data: { slug: 'slug-1' }, error: null });

    const result = await revokeSharedConversation('c1', 'slug-1');

    expect(result).toEqual({ slug: 'slug-1', revoked: true });
    const call = callsFor('shared_conversations')[0];
    expect(call.ops).toContainEqual(['eq', 'creator_id', 'c1']);
    expect(call.ops.find((op) => op[0] === 'update')?.[1]).toMatchObject({ revoked: true });
  });

  it('responde 404 quando o link é de outro creator', async () => {
    push({ data: null, error: null });
    await expect(revokeSharedConversation('c2', 'slug-1')).rejects.toMatchObject({ statusCode: 404 });
  });
});
