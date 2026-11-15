import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ calls: [] as string[] }));

vi.mock('../src/lib/supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      insert: vi.fn(async () => ({ error: null })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })),
      })),
    })),
    auth: {
      getUser: vi.fn(),
      signInWithPassword: vi.fn(),
      admin: {
        getUserById: vi.fn(),
        updateUserById: vi.fn(),
        deleteUser: vi.fn(),
      },
    },
  },
}));

vi.mock('../src/modules/billing/billing.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/modules/billing/billing.service.js')>();
  return {
    ...actual,
    cancelSubscriptionsForAccountDeletion: vi.fn(async () => {
      state.calls.push('cancel');
    }),
  };
});

vi.mock('../src/modules/creators/creator.repository.js', () => ({
  findCreatorByUserId: vi.fn(async () => ({ id: 'creator-1' })),
  updateCreator: vi.fn(async () => undefined),
}));

import { buildApp } from '../src/app.js';
import { supabaseAdmin } from '../src/lib/supabase.js';
import { cancelSubscriptionsForAccountDeletion } from '../src/modules/billing/billing.service.js';

const auth = supabaseAdmin.auth as unknown as {
  getUser: ReturnType<typeof vi.fn>;
  signInWithPassword: ReturnType<typeof vi.fn>;
  admin: {
    getUserById: ReturnType<typeof vi.fn>;
    updateUserById: ReturnType<typeof vi.fn>;
    deleteUser: ReturnType<typeof vi.fn>;
  };
};

const cancelMock = cancelSubscriptionsForAccountDeletion as unknown as ReturnType<typeof vi.fn>;

function userRecord(id: string, provider: 'email' | 'google' = 'email') {
  return {
    id,
    email: 'creator@example.com',
    app_metadata: { provider },
    identities: [{ provider }],
    user_metadata: {},
  };
}

/** Cada teste usa um token/usuário próprio para não colidir com o rate limit. */
function authenticateAs(user: ReturnType<typeof userRecord>, token: string) {
  auth.getUser.mockResolvedValue({ data: { user }, error: null });
  auth.admin.getUserById.mockResolvedValue({ data: { user }, error: null });
  return { authorization: `Bearer ${token}` };
}

beforeEach(() => {
  state.calls = [];
  auth.getUser.mockReset();
  auth.signInWithPassword.mockReset();
  auth.admin.getUserById.mockReset();
  auth.admin.updateUserById.mockReset();
  auth.admin.deleteUser.mockReset();
  cancelMock.mockClear();
});

describe('POST /account/password', () => {
  it('rejects a new password shorter than 8 characters before touching Supabase', async () => {
    const headers = authenticateAs(userRecord('11111111-1111-4111-8111-111111111111'), 'token-short-password');
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/account/password',
      headers,
      payload: { current_password: 'senha-atual', new_password: '1234567' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
    expect(auth.admin.updateUserById).not.toHaveBeenCalled();
    await app.close();
  });

  it('rejects when the current password does not match', async () => {
    const headers = authenticateAs(userRecord('22222222-2222-4222-8222-222222222222'), 'token-wrong-password');
    auth.signInWithPassword.mockResolvedValue({ data: null, error: { message: 'invalid credentials' } });
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/account/password',
      headers,
      payload: { current_password: 'senha-errada', new_password: 'nova-senha-123' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('INVALID_PASSWORD');
    expect(auth.admin.updateUserById).not.toHaveBeenCalled();
    await app.close();
  });

  it('updates the password after reauthentication', async () => {
    const user = userRecord('33333333-3333-4333-8333-333333333333');
    const headers = authenticateAs(user, 'token-valid-password');
    auth.signInWithPassword.mockResolvedValue({ data: { session: {} }, error: null });
    auth.admin.updateUserById.mockResolvedValue({ data: { user }, error: null });
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/account/password',
      headers,
      payload: { current_password: 'senha-atual', new_password: 'nova-senha-123' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'creator@example.com',
      password: 'senha-atual',
    });
    expect(auth.admin.updateUserById).toHaveBeenCalledWith(user.id, { password: 'nova-senha-123' });
    await app.close();
  });

  it('refuses password changes for social-only accounts', async () => {
    const headers = authenticateAs(userRecord('44444444-4444-4444-8444-444444444444', 'google'), 'token-social-password');
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/account/password',
      headers,
      payload: { current_password: 'qualquer-coisa', new_password: 'nova-senha-123' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.message).toContain('login social');
    expect(auth.admin.updateUserById).not.toHaveBeenCalled();
    await app.close();
  });
});

describe('DELETE /account', () => {
  it('requires the e-mail confirmation to match the account', async () => {
    const headers = authenticateAs(userRecord('55555555-5555-4555-8555-555555555555'), 'token-wrong-email');
    const app = buildApp();
    const response = await app.inject({
      method: 'DELETE',
      url: '/account',
      headers,
      payload: { confirm_email: 'outra-pessoa@example.com', current_password: 'senha-atual' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('BAD_REQUEST');
    expect(cancelMock).not.toHaveBeenCalled();
    expect(auth.admin.deleteUser).not.toHaveBeenCalled();
    await app.close();
  });

  it('requires the current password for e-mail accounts', async () => {
    const headers = authenticateAs(userRecord('66666666-6666-4666-8666-666666666666'), 'token-no-password');
    const app = buildApp();
    const response = await app.inject({
      method: 'DELETE',
      url: '/account',
      headers,
      payload: { confirm_email: 'creator@example.com' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.message).toContain('senha atual');
    expect(cancelMock).not.toHaveBeenCalled();
    expect(auth.admin.deleteUser).not.toHaveBeenCalled();
    await app.close();
  });

  it('cancels the subscription before deleting the account', async () => {
    const user = userRecord('77777777-7777-4777-8777-777777777777');
    const headers = authenticateAs(user, 'token-delete-email');
    auth.signInWithPassword.mockResolvedValue({ data: { session: {} }, error: null });
    auth.admin.deleteUser.mockImplementation(async () => {
      state.calls.push('delete');
      return { data: { user: null }, error: null };
    });
    const app = buildApp();
    const response = await app.inject({
      method: 'DELETE',
      url: '/account',
      headers,
      payload: { confirm_email: 'Creator@Example.com', current_password: 'senha-atual' },
    });

    expect(response.statusCode).toBe(204);
    expect(state.calls).toEqual(['cancel', 'delete']);
    expect(cancelMock).toHaveBeenCalledWith('creator-1');
    expect(auth.admin.deleteUser).toHaveBeenCalledWith(user.id);
    await app.close();
  });

  it('deletes social-only accounts without asking for a password but still cancels billing', async () => {
    const user = userRecord('88888888-8888-4888-8888-888888888888', 'google');
    const headers = authenticateAs(user, 'token-delete-social');
    auth.admin.deleteUser.mockImplementation(async () => {
      state.calls.push('delete');
      return { data: { user: null }, error: null };
    });
    const app = buildApp();
    const response = await app.inject({
      method: 'DELETE',
      url: '/account',
      headers,
      payload: { confirm_email: 'creator@example.com' },
    });

    expect(response.statusCode).toBe(204);
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
    expect(state.calls).toEqual(['cancel', 'delete']);
    await app.close();
  });

  it('does not delete the account when the provider cancellation fails', async () => {
    const headers = authenticateAs(userRecord('99999999-9999-4999-8999-999999999999'), 'token-delete-fails');
    auth.signInWithPassword.mockResolvedValue({ data: { session: {} }, error: null });
    cancelMock.mockRejectedValueOnce({
      statusCode: 502,
      code: 'BILLING_CANCEL_FAILED',
      message: 'Não conseguimos cancelar sua assinatura agora.',
    });
    const app = buildApp();
    const response = await app.inject({
      method: 'DELETE',
      url: '/account',
      headers,
      payload: { confirm_email: 'creator@example.com', current_password: 'senha-atual' },
    });

    expect(response.statusCode).toBe(502);
    expect(response.json().error.code).toBe('BILLING_CANCEL_FAILED');
    expect(auth.admin.deleteUser).not.toHaveBeenCalled();
    await app.close();
  });
});
