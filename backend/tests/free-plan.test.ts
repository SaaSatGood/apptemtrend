import { beforeEach, describe, expect, it, vi } from 'vitest';

const quota = vi.hoisted(() => ({ weekSearches: 0, weekKits: 0 }));

vi.mock('../src/lib/supabase.js', () => ({
  supabaseAdmin: {
    rpc: vi.fn(async (name: string, args: {
      p_kind?: string;
      p_limit?: number;
    }) => {
      if (name === 'release_ai_quota_on') {
        if (args.p_kind === 'assistant') quota.weekSearches = Math.max(0, quota.weekSearches - 1);
        else quota.weekKits = Math.max(0, quota.weekKits - 1);
        return { error: null };
      }
      if (name === 'reserve_free_quota_week') {
        const key = args.p_kind === 'assistant' ? 'weekSearches' : 'weekKits';
        const allowed = quota[key] < (args.p_limit ?? 0);
        if (allowed) quota[key] += 1;
        return { data: allowed, error: null };
      }
      return { data: null, error: null };
    }),
  },
}));

import {
  quotaDayKey,
  quotaResetIso,
  quotaWeekStartKey,
  releaseFreeQuota,
  reserveFreeAssistantQuota,
  reserveFreeKitQuota,
} from '../src/lib/ai-metrics.js';

beforeEach(() => {
  quota.weekSearches = 0;
  quota.weekKits = 0;
});

describe('cotas semanais do plano Grátis', () => {
  it('limita as buscas na semana e libera na semana seguinte', async () => {
    expect(await reserveFreeAssistantQuota('user-1', 3)).toBe(true);
    expect(await reserveFreeAssistantQuota('user-1', 3)).toBe(true);
    expect(await reserveFreeAssistantQuota('user-1', 3)).toBe(true);
    expect(await reserveFreeAssistantQuota('user-1', 3)).toBe(false);

    // Nova semana (janela zerada) volta a permitir.
    quota.weekSearches = 0;
    expect(await reserveFreeAssistantQuota('user-1', 3)).toBe(true);
  });

  it('limita os roteiros na semana e libera na semana seguinte', async () => {
    expect(await reserveFreeKitQuota('user-1', 'creator-1', 3)).toBe(true);
    expect(await reserveFreeKitQuota('user-1', 'creator-1', 3)).toBe(true);
    expect(await reserveFreeKitQuota('user-1', 'creator-1', 3)).toBe(true);
    expect(await reserveFreeKitQuota('user-1', 'creator-1', 3)).toBe(false);

    await releaseFreeQuota('user-1', 'kit');
    expect(await reserveFreeKitQuota('user-1', 'creator-1', 3)).toBe(true);

    // Nova semana (janela zerada) volta a permitir.
    quota.weekKits = 0;
    expect(await reserveFreeKitQuota('user-1', 'creator-1', 3)).toBe(true);
  });
});

describe('janelas de renovação (America/Sao_Paulo)', () => {
  it('identifica o dia local para gravar o uso', () => {
    expect(quotaDayKey(new Date('2026-01-05T02:59:59.000Z'))).toBe('2026-01-04');
    expect(quotaDayKey(new Date('2026-01-05T03:00:00.000Z'))).toBe('2026-01-05');
  });

  it('a semana começa na segunda-feira local', () => {
    // 08/01/2026 é quinta; a segunda da mesma semana é 05/01.
    expect(quotaWeekStartKey(new Date('2026-01-08T12:00:00.000Z'))).toBe('2026-01-05');
  });

  it('calcula o próximo reset semanal', () => {
    const date = new Date('2026-01-05T12:00:00.000Z');
    expect(quotaResetIso('week', date)).toBe('2026-01-12T03:00:00.000Z');
  });
});
