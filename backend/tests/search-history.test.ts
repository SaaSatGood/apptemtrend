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

function lastCall(): Call {
  return state.calls[state.calls.length - 1] as Call;
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
      chain.upsert = (payload: unknown, options: unknown) => {
        call.ops.push(['upsert', payload, options]);
        return chain;
      };
      chain.maybeSingle = async () => state.responses.shift() ?? { data: null, error: null };
      chain.single = async () => state.responses.shift() ?? { data: null, error: null };
      chain.then = (resolve: (value: Terminal) => unknown) => resolve(state.responses.shift() ?? { data: null, error: null });
      return chain;
    },
  },
}));

import {
  MAX_SAVED_SEARCHES,
  clearSearches,
  deleteSearch,
  getSearch,
  listSearches,
  saveSearch,
  searchQueryKey,
} from '../src/modules/assistant/search-history.service.js';

beforeEach(() => {
  state.calls.length = 0;
  state.responses.length = 0;
});

describe('searchQueryKey', () => {
  it('ignora acentos, caixa e espaços extras', () => {
    expect(searchQueryKey('  Produtos   para ORGANIZAÇÃO ')).toBe('produtos para organizacao');
    expect(searchQueryKey('Ação')).toBe(searchQueryKey('acao'));
  });
});

describe('saveSearch', () => {
  it('faz upsert pelo par creator + texto normalizado e guarda o retrato da busca', async () => {
    push({ data: { id: 's1' }, error: null }); // upsert
    push({ data: [], error: null }); // poda

    const result = await saveSearch({
      creatorId: 'c1',
      userId: 'u1',
      query: '  Produtos   de Casa ',
      message: 'Encontrei 2 produtos para você.',
      products: [{ id: 'p1', nome: 'Organizador' }, { id: 'p2', nome: 'Kit' }],
      needsClarification: false,
    });

    expect(result).toEqual({ id: 's1' });
    const upsertCall = state.calls.find((call) => call.ops.some((op) => op[0] === 'upsert'));
    expect(upsertCall?.table).toBe('discovery_searches');
    const upsert = upsertCall?.ops.find((op) => op[0] === 'upsert');
    expect(upsert?.[2]).toEqual({ onConflict: 'creator_id,query_key' });
    expect(upsert?.[1]).toMatchObject({
      creator_id: 'c1',
      user_id: 'u1',
      query: 'Produtos de Casa',
      query_key: 'produtos de casa',
      result_count: 2,
      context_ids: ['p1', 'p2'],
      needs_clarification: false,
    });
    // Rebuscar a mesma frase atualiza updated_at, mas preserva created_at.
    expect(upsert?.[1]).not.toHaveProperty('created_at');
  });

  it('poda o histórico mantendo só as buscas mais recentes', async () => {
    push({ data: { id: 's1' }, error: null });
    push({ data: [{ id: 'old-1' }, { id: 'old-2' }], error: null }); // select da poda
    push({ error: null }); // delete da poda

    await saveSearch({ creatorId: 'c1', userId: 'u1', query: 'casa', products: [] });

    const pruneSelect = state.calls.find((call) => call.ops.some((op) => op[0] === 'range'));
    expect(pruneSelect?.ops).toContainEqual(['range', MAX_SAVED_SEARCHES, MAX_SAVED_SEARCHES + 49]);

    const pruneDelete = state.calls.find((call) => call.ops.some((op) => op[0] === 'in'));
    expect(pruneDelete?.ops).toContainEqual(['in', 'id', ['old-1', 'old-2']]);
    expect(pruneDelete?.ops).toContainEqual(['eq', 'creator_id', 'c1']);
  });

  it('não derruba a busca quando a persistência falha', async () => {
    push({ data: null, error: { message: 'boom' } });

    await expect(saveSearch({ creatorId: 'c1', userId: 'u1', query: 'casa' })).resolves.toBeNull();
    expect(state.calls.some((call) => call.ops.some((op) => op[0] === 'range'))).toBe(false);
  });
});

describe('listSearches', () => {
  it('lista do mais recente para o mais antigo, limitado ao teto', async () => {
    push({
      data: [
        { id: 's1', query: 'casa', result_count: 3, needs_clarification: false, created_at: '2026-10-20T10:00:00Z', updated_at: '2026-10-20T10:00:00Z' },
        { id: 's2', query: 'beleza', result_count: 1, needs_clarification: true, created_at: '2026-10-19T10:00:00Z', updated_at: '2026-10-19T10:00:00Z' },
      ],
      error: null,
    });

    const items = await listSearches('c1');

    expect(items).toEqual([
      { id: 's1', query: 'casa', result_count: 3, needs_clarification: false, created_at: '2026-10-20T10:00:00Z', updated_at: '2026-10-20T10:00:00Z' },
      { id: 's2', query: 'beleza', result_count: 1, needs_clarification: true, created_at: '2026-10-19T10:00:00Z', updated_at: '2026-10-19T10:00:00Z' },
    ]);
    const call = lastCall();
    expect(call.ops).toContainEqual(['eq', 'creator_id', 'c1']);
    expect(call.ops).toContainEqual(['order', 'updated_at', { ascending: false }]);
    expect(call.ops).toContainEqual(['limit', MAX_SAVED_SEARCHES]);
  });
});

describe('getSearch', () => {
  it('devolve o retrato completo da busca do próprio creator', async () => {
    push({
      data: {
        id: 's1',
        query: 'casa',
        message: 'Encontrei 1 produto.',
        results: [{ id: 'p1', nome: 'Organizador' }],
        context_ids: ['p1'],
        needs_clarification: false,
        result_count: 1,
        created_at: '2026-10-20T10:00:00Z',
        updated_at: '2026-10-20T10:00:00Z',
      },
      error: null,
    });

    const saved = await getSearch('c1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

    expect(saved.results).toEqual([{ id: 'p1', nome: 'Organizador' }]);
    expect(saved.context_ids).toEqual(['p1']);
    expect(saved.message).toBe('Encontrei 1 produto.');
    const call = lastCall();
    expect(call.ops).toContainEqual(['eq', 'id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']);
    expect(call.ops).toContainEqual(['eq', 'creator_id', 'c1']);
  });

  it('não encontra busca de outro creator', async () => {
    push({ data: null, error: null });

    await expect(getSearch('c1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
      statusCode: 404,
    });
  });
});

describe('deleteSearch e clearSearches', () => {
  it('remove apenas a busca do creator', async () => {
    push({ error: null });

    await expect(deleteSearch('c1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).resolves.toEqual({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      deleted: true,
    });
    const call = lastCall();
    expect(call.table).toBe('discovery_searches');
    expect(call.ops).toContainEqual(['delete']);
    expect(call.ops).toContainEqual(['eq', 'id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']);
    expect(call.ops).toContainEqual(['eq', 'creator_id', 'c1']);
  });

  it('limpa o histórico e informa quantas buscas saíram', async () => {
    push({ data: [{ id: 's1' }, { id: 's2' }], error: null });

    await expect(clearSearches('c1')).resolves.toEqual({ deleted: 2 });
    const call = lastCall();
    expect(call.ops).toContainEqual(['delete']);
    expect(call.ops).toContainEqual(['eq', 'creator_id', 'c1']);
    expect(call.ops).toContainEqual(['select', 'id']);
  });
});
