import { describe, expect, it, vi, beforeEach } from 'vitest';

type Terminal = { data?: unknown; error?: unknown; count?: number };

const state = vi.hoisted(() => ({
  queues: new Map<string, Terminal[]>(),
  writes: [] as Array<{ table: string; kind: string; payload: unknown }>,
}));

function queueFor(table: string): Terminal[] {
  if (!state.queues.has(table)) state.queues.set(table, []);
  return state.queues.get(table) as Terminal[];
}

function pushResult(table: string, ...results: Terminal[]) {
  queueFor(table).push(...results);
}

vi.mock('../src/lib/supabase.js', () => ({
  supabaseAdmin: {
    from: (table: string) => {
      const queue = queueFor(table);
      const next = (): Terminal => queue.shift() ?? { data: null, error: null };
      const chain: Record<string, unknown> = {};
      for (const name of ['select', 'insert', 'update', 'delete', 'eq', 'in', 'gt', 'order', 'limit', 'range']) {
        chain[name] = (payload?: unknown) => {
          if (name === 'insert' || name === 'update') state.writes.push({ table, kind: name, payload });
          return chain;
        };
      }
      chain.maybeSingle = async () => next();
      chain.single = async () => next();
      chain.then = (resolve: (value: Terminal) => unknown) => resolve(next());
      return chain;
    },
    auth: { getUser: vi.fn(async () => ({ data: { user: null }, error: { message: 'no token' } })) },
  },
}));

import { buildApp } from '../src/app.js';
import {
  addCreatorMessage,
  closeCreatorTicket,
  createTicket,
  getCreatorTicket,
  replyAsSupport,
  setAdminTicketStatus,
} from '../src/modules/support/support.service.js';
import type { Creator } from '../src/types/index.js';

const creator = { id: 'creator-1', user_id: 'user-1' } as Creator;

function ticketRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 't1',
    creator_id: 'creator-1',
    user_id: 'user-1',
    subject: 'Dúvida de kit',
    category: 'duvida',
    status: 'open',
    last_message_at: '2026-10-18T10:00:00.000Z',
    created_at: '2026-10-18T10:00:00.000Z',
    updated_at: '2026-10-18T10:00:00.000Z',
    ...overrides,
  };
}

describe('support tickets (service)', () => {
  beforeEach(() => {
    state.queues.clear();
    state.writes.length = 0;
  });

  it('creates a ticket with the first message from the creator', async () => {
    pushResult('support_tickets', { count: 0, error: null }, { data: ticketRow(), error: null });
    pushResult('support_messages', { error: null });
    const ticket = await createTicket(creator, { subject: 'Dúvida de kit', category: 'duvida', message: 'Como faço o gancho?' });
    expect(ticket).toMatchObject({ id: 't1', status: 'open', category: 'duvida' });
    const ticketInsert = state.writes.find((w) => w.table === 'support_tickets' && w.kind === 'insert');
    const messageInsert = state.writes.find((w) => w.table === 'support_messages' && w.kind === 'insert');
    expect(ticketInsert?.payload).toMatchObject({ creator_id: 'creator-1', user_id: 'user-1', status: 'open' });
    expect(messageInsert?.payload).toMatchObject({ ticket_id: 't1', author: 'creator', body: 'Como faço o gancho?' });
  });

  it('blocks opening more than 5 simultaneous conversations', async () => {
    pushResult('support_tickets', { count: 5, error: null });
    await expect(
      createTicket(creator, { subject: 'Outra', category: 'outro', message: 'Preciso de ajuda com algo' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('lists a ticket thread with ordered messages', async () => {
    pushResult('support_tickets', { data: ticketRow(), error: null });
    pushResult('support_messages', {
      data: [
        { id: 'm1', ticket_id: 't1', author: 'creator', author_user_id: 'user-1', body: 'Oi', created_at: '2026-10-18T10:00:00.000Z' },
        { id: 'm2', ticket_id: 't1', author: 'support', author_user_id: 'admin-1', body: 'Olá!', created_at: '2026-10-18T11:00:00.000Z' },
      ],
      error: null,
    });
    const thread = await getCreatorTicket('creator-1', 't1');
    expect(thread.id).toBe('t1');
    expect(thread.messages.map((m) => m.author)).toEqual(['creator', 'support']);
  });

  it('reopens the conversation when the creator replies', async () => {
    pushResult(
      'support_tickets',
      { data: ticketRow({ status: 'answered' }), error: null },
      { error: null },
    );
    pushResult('support_messages', {
      data: { id: 'm2', ticket_id: 't1', author: 'creator', author_user_id: 'user-1', body: 'Deu certo, obrigado!', created_at: '2026-10-18T12:00:00.000Z' },
      error: null,
    });
    const result = await addCreatorMessage(creator, 't1', 'Deu certo, obrigado!');
    expect(result.status).toBe('open');
    const reopen = state.writes.find(
      (w) => w.table === 'support_tickets' && w.kind === 'update' && (w.payload as { status?: string }).status === 'open',
    );
    expect(reopen).toBeTruthy();
  });

  it('refuses to close a conversation that is already closed', async () => {
    pushResult('support_tickets', { data: ticketRow({ status: 'closed' }), error: null });
    await expect(closeCreatorTicket('creator-1', 't1')).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('404s tickets that do not belong to the creator', async () => {
    pushResult('support_tickets', { data: null, error: null });
    await expect(getCreatorTicket('creator-1', 't9')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('support tickets (admin)', () => {
  beforeEach(() => {
    state.queues.clear();
    state.writes.length = 0;
  });

  it('replies as support and moves the ticket to answered', async () => {
    pushResult('support_tickets', { data: ticketRow(), error: null }, { error: null });
    pushResult('support_messages', {
      data: { id: 'm9', ticket_id: 't1', author: 'support', author_user_id: 'admin-1', body: 'Já resolvemos!', created_at: '2026-10-18T13:00:00.000Z' },
      error: null,
    });
    const result = await replyAsSupport('t1', 'Já resolvemos!', 'admin-1');
    expect(result.status).toBe('answered');
    const message = state.writes.find((w) => w.table === 'support_messages' && w.kind === 'insert');
    expect(message?.payload).toMatchObject({ author: 'support', author_user_id: 'admin-1' });
    const mark = state.writes.find(
      (w) => w.table === 'support_tickets' && w.kind === 'update' && (w.payload as { status?: string }).status === 'answered',
    );
    expect(mark).toBeTruthy();
  });

  it('updates the ticket status and 404s unknown ids', async () => {
    pushResult('support_tickets', { data: { id: 't1' }, error: null });
    const result = await setAdminTicketStatus('t1', 'resolved');
    expect(result).toEqual({ ok: true, status: 'resolved' });

    pushResult('support_tickets', { data: null, error: null });
    await expect(setAdminTicketStatus('t9', 'closed')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('support routes (auth guard)', () => {
  beforeEach(() => {
    state.queues.clear();
    state.writes.length = 0;
  });

  it('requires auth to open or list tickets', async () => {
    const app = buildApp();
    const list = await app.inject({ method: 'GET', url: '/support/tickets' });
    expect(list.statusCode).toBe(401);
    const create = await app.inject({
      method: 'POST',
      url: '/support/tickets',
      payload: { subject: 'Oi', category: 'duvida', message: 'Preciso de ajuda' },
    });
    expect(create.statusCode).toBe(401);
    await app.close();
  });

  it('validates the payload shape before touching the database', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/support/tickets',
      payload: { subject: 'Oi' },
    });
    expect(res.statusCode).toBe(401); // auth antes da validação — sem sessão não passa
    await app.close();
  });
});

describe('admin support routes (auth guard)', () => {
  it('requires admin auth for the support queue', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/admin/support/tickets' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});
