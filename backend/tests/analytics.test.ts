import { describe, expect, it, vi, beforeEach } from 'vitest';

const insert = vi.fn();
const from = vi.fn((_table: string) => ({ insert }));

vi.mock('../src/lib/supabase.js', () => ({
  supabaseAdmin: {
    from: (table: string) => from(table),
    auth: { getUser: vi.fn(async () => ({ data: { user: null }, error: { message: 'no token' } })) },
  },
}));

import { buildApp } from '../src/app.js';

describe('analytics events', () => {
  beforeEach(() => {
    insert.mockReset();
    from.mockClear();
    insert.mockResolvedValue({ error: null });
  });

  it('records an anonymous funnel event', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/events',
      payload: { name: 'landing_view', props: { ref: 'direct' }, path: '/' },
    });
    expect(res.statusCode).toBe(202);
    expect(res.json()).toEqual({ ok: true });
    expect(from).toHaveBeenCalledWith('analytics_events');
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: null,
        name: 'landing_view',
        props: { ref: 'direct' },
        path: '/',
      })
    );
    await app.close();
  });

  it('rejects unknown event names', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/events',
      payload: { name: 'drop_tables' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('BAD_REQUEST');
    expect(insert).not.toHaveBeenCalled();
    await app.close();
  });

  it('rejects oversized props', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/events',
      payload: { name: 'landing_search', props: { q: 'x'.repeat(500) } },
    });
    expect(res.statusCode).toBe(400);
    expect(insert).not.toHaveBeenCalled();
    await app.close();
  });

  it('never breaks the client when the insert fails', async () => {
    insert.mockResolvedValue({ error: { message: 'db down' } });
    const app = buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/events',
      payload: { name: 'landing_view' },
    });
    expect(res.statusCode).toBe(202);
    expect(res.json()).toEqual({ ok: false });
    await app.close();
  });
});
