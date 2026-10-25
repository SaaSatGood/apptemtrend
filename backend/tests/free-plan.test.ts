import { beforeEach, describe, expect, it, vi } from 'vitest';

const quota = vi.hoisted(() => ({ previousSearches: 0, previousKits: 0, todaySearches: 0, todayKits: 0 }));

vi.mock('../src/lib/supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      const query: Record<string, unknown> = {};
      query.select = () => query;
      query.eq = () => query;
      query.gt = () => query;
      query.limit = () => query;
      query.lt = () => query;
      query.then = (resolve: (value: unknown) => void) => resolve(table === 'ai_usage_daily'
        ? { data: [{ assistant_calls: quota.previousSearches }], error: null }
        : { count: quota.previousKits, error: null });
      return query;
    }),
    rpc: vi.fn(async (name: string, args: { p_kind: string; p_daily_limit: number }) => {
      if (name === 'release_ai_quota') {
        if (args.p_kind === 'assistant') quota.todaySearches--;
        else quota.todayKits--;
        return { error: null };
      }
      const key = args.p_kind === 'assistant' ? 'todaySearches' : 'todayKits';
      const allowed = quota[key] < args.p_daily_limit;
      if (allowed) quota[key]++;
      return { data: allowed, error: null };
    }),
  },
}));

import { reserveFreeAssistantQuota, reserveFreeKitQuota, releaseFreeQuota } from '../src/lib/ai-metrics.js';

beforeEach(() => {
  quota.previousSearches = 0;
  quota.previousKits = 0;
  quota.todaySearches = 0;
  quota.todayKits = 0;
});

describe('lifetime free quota', () => {
  it('blocks the fourth product search across days', async () => {
    quota.previousSearches = 1;
    expect(await reserveFreeAssistantQuota('user-1', 3)).toBe(true);
    expect(await reserveFreeAssistantQuota('user-1', 3)).toBe(true);
    expect(await reserveFreeAssistantQuota('user-1', 3)).toBe(false);
  });

  it('blocks the fourth script and releases failed generation reservations', async () => {
    quota.previousKits = 1;
    expect(await reserveFreeKitQuota('user-1', 'creator-1', 3)).toBe(true);
    expect(await reserveFreeKitQuota('user-1', 'creator-1', 3)).toBe(true);
    expect(await reserveFreeKitQuota('user-1', 'creator-1', 3)).toBe(false);
    await releaseFreeQuota('user-1', 'kit');
    expect(await reserveFreeKitQuota('user-1', 'creator-1', 3)).toBe(true);
  });
});
