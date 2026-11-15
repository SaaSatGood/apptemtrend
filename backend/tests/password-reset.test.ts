import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  identity: null as Record<string, unknown> | null,
  activeCode: null as Record<string, unknown> | null,
  recent: [] as unknown[],
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
      rpc: vi.fn(async () => ({ data: state.identity ? [state.identity] : [], error: null })),
      auth: {
        getUser: vi.fn(async () => ({ data: { user: null }, error: { message: 'no token' } })),
        admin: {
          getUserById: vi.fn(async () => ({ data: { user: { user_metadata: { full_name: 'Ana Souza' } } }, error: null })),
          updateUserById: vi.fn(async () => ({ data: { user: {} }, error: null })),
          createUser: vi.fn(),
          deleteUser: vi.fn(),
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
import { hashVerificationCode } from '../src/modules/signup/verification-codes.js';

const admin = supabaseAdmin.auth.admin as unknown as {
  updateUserById: ReturnType<typeof vi.fn>;
  getUserById: ReturnType<typeof vi.fn>;
};
const sendEmail = sendVerificationCodeEmail as unknown as ReturnType<typeof vi.fn>;

const EMAIL = 'ana@exemplo.com';
let ipCounter = 0;
function nextIp(): string {
  ipCounter += 1;
  return `10.20.0.${ipCounter}`;
}

beforeEach(() => {
  state.identity = null;
  state.activeCode = null;
  state.recent = [];
  state.inserted = [];
  state.updates = [];
  vi.clearAllMocks();
  sendEmail.mockResolvedValue(true);
  admin.updateUserById.mockResolvedValue({ data: { user: {} }, error: null });
  admin.getUserById.mockResolvedValue({ data: { user: { user_metadata: { full_name: 'Ana Souza' } } }, error: null });
});

describe('POST /auth/password/request', () => {
  it('sends a reset code for a manual email/password account', async () => {
    state.identity = { user_id: 'user-1', email_confirmed: true, has_password: true };
    const app = buildApp();
    const res = await app.inject({
      remoteAddress: nextIp(),
      method: 'POST',
      url: '/auth/password/request',
      payload: { email: ' ANA@EXEMPLO.COM ' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
    expect(state.inserted).toHaveLength(1);
    expect(state.inserted[0]).toMatchObject({ email: EMAIL, user_id: 'user-1', purpose: 'password_reset' });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect((sendEmail.mock.calls[0][0] as { to: string }).to).toBe(EMAIL);
    expect(sendEmail.mock.calls[0][1]).toBe('password_reset');
    await app.close();
  });

  it('never sends a code to a Google-only account', async () => {
    state.identity = { user_id: 'user-google', email_confirmed: true, has_password: false };
    const app = buildApp();
    const res = await app.inject({
      remoteAddress: nextIp(),
      method: 'POST',
      url: '/auth/password/request',
      payload: { email: EMAIL },
    });

    expect(res.statusCode).toBe(200);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(state.inserted).toHaveLength(0);
    await app.close();
  });

  it('keeps the same response for an unknown email', async () => {
    const app = buildApp();
    const res = await app.inject({
      remoteAddress: nextIp(),
      method: 'POST',
      url: '/auth/password/request',
      payload: { email: 'ninguem@exemplo.com' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
    expect(sendEmail).not.toHaveBeenCalled();
    await app.close();
  });

  it('does not send for an unconfirmed account', async () => {
    state.identity = { user_id: 'user-1', email_confirmed: false, has_password: true };
    const app = buildApp();
    const res = await app.inject({
      remoteAddress: nextIp(),
      method: 'POST',
      url: '/auth/password/request',
      payload: { email: EMAIL },
    });

    expect(res.statusCode).toBe(200);
    expect(sendEmail).not.toHaveBeenCalled();
    await app.close();
  });
});

describe('POST /auth/password/reset', () => {
  function resetCode(code: string, overrides: Record<string, unknown> = {}) {
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

  it('changes the password when code and account are valid', async () => {
    state.identity = { user_id: 'user-1', email_confirmed: true, has_password: true };
    state.activeCode = resetCode('123456');
    const app = buildApp();
    const res = await app.inject({
      remoteAddress: nextIp(),
      method: 'POST',
      url: '/auth/password/reset',
      payload: { email: EMAIL, code: '123456', password: 'nova-senha-123' },
    });

    expect(res.statusCode).toBe(200);
    expect(admin.updateUserById).toHaveBeenCalledWith('user-1', { password: 'nova-senha-123' });
    await app.close();
  });

  it('rejects a wrong code without changing the password', async () => {
    state.identity = { user_id: 'user-1', email_confirmed: true, has_password: true };
    state.activeCode = resetCode('123456');
    const app = buildApp();
    const res = await app.inject({
      remoteAddress: nextIp(),
      method: 'POST',
      url: '/auth/password/reset',
      payload: { email: EMAIL, code: '000000', password: 'nova-senha-123' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('CODE_INVALID');
    expect(admin.updateUserById).not.toHaveBeenCalled();
    await app.close();
  });

  it('refuses password reset for a Google-only account', async () => {
    state.identity = { user_id: 'user-google', email_confirmed: true, has_password: false };
    state.activeCode = resetCode('123456');
    const app = buildApp();
    const res = await app.inject({
      remoteAddress: nextIp(),
      method: 'POST',
      url: '/auth/password/reset',
      payload: { email: EMAIL, code: '123456', password: 'nova-senha-123' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('PASSWORD_RESET_UNAVAILABLE');
    expect(admin.updateUserById).not.toHaveBeenCalled();
    await app.close();
  });

  it('rejects a password shorter than 8 characters', async () => {
    state.identity = { user_id: 'user-1', email_confirmed: true, has_password: true };
    state.activeCode = resetCode('123456');
    const app = buildApp();
    const res = await app.inject({
      remoteAddress: nextIp(),
      method: 'POST',
      url: '/auth/password/reset',
      payload: { email: EMAIL, code: '123456', password: 'curta' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
    expect(admin.updateUserById).not.toHaveBeenCalled();
    await app.close();
  });

  it('rejects an expired code', async () => {
    state.identity = { user_id: 'user-1', email_confirmed: true, has_password: true };
    state.activeCode = resetCode('123456', { expires_at: new Date(Date.now() - 1000).toISOString() });
    const app = buildApp();
    const res = await app.inject({
      remoteAddress: nextIp(),
      method: 'POST',
      url: '/auth/password/reset',
      payload: { email: EMAIL, code: '123456', password: 'nova-senha-123' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('CODE_EXPIRED');
    expect(admin.updateUserById).not.toHaveBeenCalled();
    await app.close();
  });
});
