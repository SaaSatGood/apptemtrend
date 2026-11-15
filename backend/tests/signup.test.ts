import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  activeCode: null as Record<string, unknown> | null,
  recent: [] as unknown[],
  rpcRows: null as unknown,
  inserted: [] as Array<Record<string, unknown>>,
  updates: [] as Array<Record<string, unknown>>,
}));

vi.mock('../src/lib/supabase.js', () => {
  const from = vi.fn((_table: string) => {
    const updateChain: Record<string, unknown> = {
      then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
        Promise.resolve({ error: null }).then(resolve, reject),
    };
    updateChain.is = () => updateChain;
    updateChain.eq = () => updateChain;

    return {
      select: (fields: string) => {
        if (fields === 'id') {
          const chain = {
            eq: () => chain,
            gte: () => chain,
            limit: async () => ({ data: state.recent, error: null }),
          };
          return chain;
        }
        const chain = {
          eq: () => chain,
          is: () => chain,
          order: () => chain,
          limit: () => chain,
          maybeSingle: async () => ({ data: state.activeCode, error: null }),
        };
        return chain;
      },
      insert: (payload: Record<string, unknown>) => {
        state.inserted.push(payload);
        return {
          select: () => ({
            maybeSingle: async () => ({ data: { id: 'code-1' }, error: null }),
          }),
        };
      },
      update: (payload: Record<string, unknown>) => {
        state.updates.push(payload);
        return updateChain;
      },
      delete: () => ({
        eq: async () => ({ error: null }),
      }),
    };
  });

  return {
    supabaseAdmin: {
      from,
      rpc: vi.fn(async () => ({ data: state.rpcRows, error: null })),
      auth: {
        getUser: vi.fn(async () => ({ data: { user: null }, error: { message: 'no token' } })),
        admin: {
          createUser: vi.fn(),
          updateUserById: vi.fn(async () => ({ data: { user: {} }, error: null })),
          deleteUser: vi.fn(async () => ({ error: null })),
          getUserById: vi.fn(async () => ({ data: { user: { user_metadata: {} } }, error: null })),
        },
      },
    },
  };
});

vi.mock('../src/lib/email.js', () => ({
  sendVerificationCodeEmail: vi.fn(async () => true),
}));

import { buildApp } from '../src/app.js';
import { supabaseAdmin } from '../src/lib/supabase.js';
import { sendVerificationCodeEmail } from '../src/lib/email.js';
import { hashVerificationCode } from '../src/modules/signup/signup.service.js';

const admin = supabaseAdmin.auth.admin as unknown as {
  createUser: ReturnType<typeof vi.fn>;
  updateUserById: ReturnType<typeof vi.fn>;
  deleteUser: ReturnType<typeof vi.fn>;
  getUserById: ReturnType<typeof vi.fn>;
};
const sendEmail = sendVerificationCodeEmail as unknown as ReturnType<typeof vi.fn>;

const EMAIL = 'ana@exemplo.com';

// Cada requisição usa um IP próprio: o rate limit das rotas públicas é por IP
// e os testes não devem interferir uns nos outros.
let ipCounter = 0;
function nextIp(): string {
  ipCounter += 1;
  return `10.10.0.${ipCounter}`;
}

function activeCodeRow(code: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 'code-1',
    user_id: 'user-1',
    email: EMAIL,
    code_hash: hashVerificationCode(EMAIL, code),
    attempts: 0,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    consumed_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  state.activeCode = null;
  state.recent = [];
  state.rpcRows = null;
  state.inserted = [];
  state.updates = [];
  vi.clearAllMocks();
  sendEmail.mockResolvedValue(true);
  admin.createUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  admin.updateUserById.mockResolvedValue({ data: { user: {} }, error: null });
  admin.deleteUser.mockResolvedValue({ error: null });
  admin.getUserById.mockResolvedValue({ data: { user: { user_metadata: { full_name: 'Ana Souza' } } }, error: null });
});

describe('POST /auth/signup', () => {
  it('creates the account without session and emails a 6-digit code', async () => {
    const app = buildApp();
    const res = await app.inject({
      remoteAddress: nextIp(),
      method: 'POST',
      url: '/auth/signup',
      payload: { nome: '  Ana Souza ', email: '  ANA@EXEMPLO.COM ', password: 'segredo123' },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ ok: true, email: EMAIL });

    expect(admin.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: EMAIL,
        password: 'segredo123',
        email_confirm: false,
        user_metadata: { full_name: 'Ana Souza', name: 'Ana Souza' },
      }),
    );
    expect(state.inserted).toHaveLength(1);
    expect(state.inserted[0]).toMatchObject({ user_id: 'user-1', email: EMAIL });
    expect(String(state.inserted[0].code_hash)).toMatch(/^[a-f0-9]{64}$/);

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const sent = sendEmail.mock.calls[0][0] as { to: string; code: string; nome: string };
    expect(sent.to).toBe(EMAIL);
    expect(sent.nome).toBe('Ana Souza');
    expect(sent.code).toMatch(/^\d{6}$/);

    await app.close();
  });

  it('refuses an email that already has an account', async () => {
    admin.createUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'A user with this email address has already been registered' },
    });
    const app = buildApp();
    const res = await app.inject({
      remoteAddress: nextIp(),
      method: 'POST',
      url: '/auth/signup',
      payload: { nome: 'Ana Souza', email: EMAIL, password: 'segredo123' },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('EMAIL_IN_USE');
    expect(sendEmail).not.toHaveBeenCalled();
    await app.close();
  });

  it('rolls the account back when the email cannot be sent', async () => {
    sendEmail.mockResolvedValue(false);
    const app = buildApp();
    const res = await app.inject({
      remoteAddress: nextIp(),
      method: 'POST',
      url: '/auth/signup',
      payload: { nome: 'Ana Souza', email: EMAIL, password: 'segredo123' },
    });

    expect(res.statusCode).toBe(503);
    expect(res.json().error.code).toBe('EMAIL_SEND_FAILED');
    expect(admin.deleteUser).toHaveBeenCalledWith('user-1');
    await app.close();
  });
});

describe('POST /auth/verify-code', () => {
  it('confirms the email when the code matches', async () => {
    state.activeCode = activeCodeRow('123456');
    const app = buildApp();
    const res = await app.inject({
      remoteAddress: nextIp(),
      method: 'POST',
      url: '/auth/verify-code',
      payload: { email: EMAIL, code: '123456' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, verified: true, email: EMAIL });
    expect(admin.updateUserById).toHaveBeenCalledWith('user-1', { email_confirm: true });
    await app.close();
  });

  it('counts a wrong attempt without confirming the email', async () => {
    state.activeCode = activeCodeRow('123456');
    const app = buildApp();
    const res = await app.inject({
      remoteAddress: nextIp(),
      method: 'POST',
      url: '/auth/verify-code',
      payload: { email: EMAIL, code: '000000' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('CODE_INVALID');
    expect(admin.updateUserById).not.toHaveBeenCalled();
    expect(state.updates).toContainEqual({ attempts: 1 });
    await app.close();
  });

  it('rejects an expired code', async () => {
    state.activeCode = activeCodeRow('123456', {
      expires_at: new Date(Date.now() - 1000).toISOString(),
    });
    const app = buildApp();
    const res = await app.inject({
      remoteAddress: nextIp(),
      method: 'POST',
      url: '/auth/verify-code',
      payload: { email: EMAIL, code: '123456' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('CODE_EXPIRED');
    expect(admin.updateUserById).not.toHaveBeenCalled();
    await app.close();
  });

  it('rejects a malformed code before touching the database', async () => {
    const app = buildApp();
    const res = await app.inject({
      remoteAddress: nextIp(),
      method: 'POST',
      url: '/auth/verify-code',
      payload: { email: EMAIL, code: '12ab' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
    await app.close();
  });
});

describe('POST /auth/resend-code', () => {
  it('sends a new code for an unconfirmed account', async () => {
    state.rpcRows = [{ user_id: 'user-1', email_confirmed: false, has_password: true }];
    const app = buildApp();
    const res = await app.inject({
      remoteAddress: nextIp(),
      method: 'POST',
      url: '/auth/resend-code',
      payload: { email: EMAIL },
    });

    expect(res.statusCode).toBe(200);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it('keeps the response generic for an unknown email and sends nothing', async () => {
    state.rpcRows = [];
    const app = buildApp();
    const res = await app.inject({
      remoteAddress: nextIp(),
      method: 'POST',
      url: '/auth/resend-code',
      payload: { email: 'ninguem@exemplo.com' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(sendEmail).not.toHaveBeenCalled();
    await app.close();
  });

  it('throttles repeated resends for the same email', async () => {
    state.rpcRows = [{ user_id: 'user-1', email_confirmed: false, has_password: true }];
    state.recent = [{ id: 'recent-code' }];
    const app = buildApp();
    const res = await app.inject({
      remoteAddress: nextIp(),
      method: 'POST',
      url: '/auth/resend-code',
      payload: { email: EMAIL },
    });

    expect(res.statusCode).toBe(429);
    expect(res.json().error.code).toBe('CODE_RATE_LIMITED');
    expect(sendEmail).not.toHaveBeenCalled();
    await app.close();
  });
});
