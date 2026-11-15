import { describe, expect, it, vi } from 'vitest';

const counts: Record<string, number> = {
  products: 3707,
  content_kits: 26,
  discovery_searches: 25,
};

vi.mock('../src/lib/supabase.js', () => ({
  supabaseAdmin: {
    from: (table: string) => ({
      select: () => {
        const result = Promise.resolve({ count: counts[table] ?? 0, error: null });
        return Object.assign(result, {
          eq: () => Promise.resolve({ count: counts[table] ?? 0, error: null }),
        });
      },
      insert: vi.fn(async () => ({ error: null })),
    }),
    auth: { getUser: vi.fn(async () => ({ data: { user: null }, error: { message: 'no token' } })) },
  },
}));

import { buildApp } from '../src/app.js';

describe('public landing stats', () => {
  it('returns aggregate counts without personal data', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/stats' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(
      expect.objectContaining({
        products: 3707,
        kits: 26,
        searches: 25,
      })
    );
    expect(Object.keys(res.json()).sort()).toEqual(['kits', 'products', 'searches', 'updatedAt']);
    await app.close();
  });
});
