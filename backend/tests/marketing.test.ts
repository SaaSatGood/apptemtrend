import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../src/config/env.js', () => ({
  env: { RESEND_API_KEY: 're_test_key', RESEND_AUDIENCE_ID: 'aud_test' },
}));

vi.mock('../src/lib/supabase.js', () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        getUserById: vi.fn(),
        updateUserById: vi.fn(),
      },
    },
  },
}));

import { env } from '../src/config/env.js';
import { supabaseAdmin } from '../src/lib/supabase.js';
import {
  trackMarketingEvent,
  upsertMarketingContact,
  trackContatoCriadoOnce,
  trackOnboardingConcluido,
} from '../src/modules/marketing/marketing.service.js';

const admin = vi.mocked(supabaseAdmin.auth.admin);
const realFetch = globalThis.fetch;

function mockFetch(status: number) {
  globalThis.fetch = vi.fn().mockResolvedValue({ status }) as unknown as typeof fetch;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  globalThis.fetch = realFetch;
  (env as { RESEND_API_KEY?: string }).RESEND_API_KEY = 're_test_key';
});

describe('marketing.service', () => {
  it('não dispara evento sem chave configurada e sem fetch', async () => {
    (env as { RESEND_API_KEY?: string }).RESEND_API_KEY = undefined;
    const result = await trackMarketingEvent('contato.criado', { email: 'a@b.com' });
    expect(result).toBe(false);
  });

  it('não dispara evento sem email', async () => {
    mockFetch(202);
    expect(await trackMarketingEvent('contato.criado', {})).toBe(false);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('considera 202 como sucesso e outros status como falha', async () => {
    mockFetch(202);
    expect(await trackMarketingEvent('contato.criado', { email: 'a@b.com' })).toBe(true);
    mockFetch(500);
    expect(await trackMarketingEvent('contato.criado', { email: 'a@b.com' })).toBe(false);
  });

  it('nunca lança exceção quando a rede falha', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('down')) as unknown as typeof fetch;
    await expect(trackMarketingEvent('contato.criado', { email: 'a@b.com' })).resolves.toBe(false);
    await expect(upsertMarketingContact('a@b.com', 'Ana')).resolves.toBe(false);
  });

  it('cria contato e usa fallback de atualização quando já existe', async () => {
    mockFetch(201);
    expect(await upsertMarketingContact('a@b.com', 'Ana')).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ status: 422 })
      .mockResolvedValueOnce({ status: 200 });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    expect(await upsertMarketingContact('a@b.com', 'Ana')).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('boas-vindas disparam uma única vez por usuário', async () => {
    const user = { id: 'u1', app_metadata: {}, user_metadata: { full_name: 'Ana Souza' } };
    admin.getUserById.mockResolvedValue({ data: { user }, error: null } as never);
    admin.updateUserById.mockResolvedValue({ data: {}, error: null } as never);
    mockFetch(202);

    expect(await trackContatoCriadoOnce('u1', 'ana@x.com')).toBe(true);
    expect(admin.updateUserById).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ app_metadata: expect.objectContaining({ tt_welcome_sent: true }) }),
    );

    vi.clearAllMocks();
    admin.getUserById.mockResolvedValue({
      data: { user: { ...user, app_metadata: { tt_welcome_sent: true } } },
      error: null,
    } as never);
    expect(await trackContatoCriadoOnce('u1', 'ana@x.com')).toBe(true);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('onboarding concluído dispara só na primeira conclusão', async () => {
    mockFetch(202);
    expect(await trackOnboardingConcluido('a@b.com', false)).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(await trackOnboardingConcluido('a@b.com', true)).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});
