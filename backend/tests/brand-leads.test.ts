import { describe, expect, it, vi, beforeEach } from 'vitest';

const insert = vi.fn();
const select = vi.fn();

function selectChain(result: { data: unknown[]; error: unknown }) {
  const chain = {
    eq: () => chain,
    gte: () => chain,
    limit: () => Promise.resolve(result),
  };
  return chain;
}

vi.mock('../src/lib/supabase.js', () => ({
  supabaseAdmin: {
    from: () => ({ insert, select }),
    auth: { getUser: vi.fn(async () => ({ data: { user: null }, error: { message: 'no token' } })) },
  },
}));

import { buildApp } from '../src/app.js';

const payload = {
  nome: '  Ana Souza ',
  email: '  ANA@LOJAVERDE.COM ',
  telefone: '(11) 99999-9999',
  mensagem: 'Quero cadastrar utilidades para casa.',
};

describe('brand leads', () => {
  beforeEach(() => {
    insert.mockReset();
    select.mockReset();
    insert.mockResolvedValue({ error: null });
    select.mockReturnValue(selectChain({ data: [], error: null }));
  });

  it('stores a public lead with normalized fields', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'POST', url: '/brand-leads', payload });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ ok: true, duplicate: false });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        nome: 'Ana Souza',
        email: 'ana@lojaverde.com',
        telefone: '(11) 99999-9999',
        mensagem: 'Quero cadastrar utilidades para casa.',
        user_id: null,
        source: 'landing_marcas',
        status: 'novo',
      }),
    );
    await app.close();
  });

  it('does not duplicate the same email within 24h', async () => {
    select.mockReturnValue(selectChain({ data: [{ id: 'lead-1' }], error: null }));
    const app = buildApp();
    const res = await app.inject({ method: 'POST', url: '/brand-leads', payload });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ ok: true, duplicate: true });
    expect(insert).not.toHaveBeenCalled();
    await app.close();
  });

  it('rejects invalid contact data without writing', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/brand-leads',
      payload: { ...payload, email: 'nao-e-email', telefone: '123' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
    expect(insert).not.toHaveBeenCalled();
    await app.close();
  });

  it('returns a friendly error when the database write fails', async () => {
    insert.mockResolvedValue({ error: { message: 'db down' } });
    const app = buildApp();
    const res = await app.inject({ method: 'POST', url: '/brand-leads', payload });

    expect(res.statusCode).toBe(503);
    expect(res.json().error.code).toBe('BRAND_LEAD_FAILED');
    await app.close();
  });
});
