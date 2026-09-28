import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { findCreatorByUserId } from '../creators/creator.repository.js';
import { decryptToken, encryptToken } from './tiktok.crypto.js';
import { TikTokAuthorizationError, TikTokConfigurationError, TikTokNotConnectedError, TikTokTokenExpiredError } from './tiktok.errors.js';
import * as repository from './tiktok.repository.js';
import type { TikTokAccount, TikTokClient, TikTokTokenBundle } from './tiktok.types.js';

const STATE_TTL_MS = 10 * 60 * 1000;
const REFRESH_WINDOW_MS = 5 * 60 * 1000;

function assertConfig() {
  if (!env.TIKTOK_CLIENT_KEY || !env.TIKTOK_CLIENT_SECRET || !env.TIKTOK_REDIRECT_URI || !env.TIKTOK_TOKEN_ENCRYPTION_KEY) {
    throw new TikTokConfigurationError();
  }
}

function tokenDates(tokens: TikTokTokenBundle) {
  const now = Date.now();
  return {
    access_token_expires_at: new Date(now + tokens.expires_in * 1000).toISOString(),
    refresh_token_expires_at: tokens.refresh_expires_in ? new Date(now + tokens.refresh_expires_in * 1000).toISOString() : null,
  };
}

export class TikTokOAuthService {
  constructor(private client: TikTokClient) {}

  async createAuthorizationUrl(userId: string) {
    assertConfig();
    const creator = await findCreatorByUserId(userId);
    if (!creator) throw new TikTokAuthorizationError();
    const state = crypto.randomBytes(32).toString('base64url');
    await repository.createOAuthState(userId, state, new Date(Date.now() + STATE_TTL_MS));
    const query = new URLSearchParams({
      client_key: env.TIKTOK_CLIENT_KEY!,
      response_type: 'code',
      scope: 'user.info.basic,video.publish',
      redirect_uri: env.TIKTOK_REDIRECT_URI!,
      state,
    });
    logger.info({ creatorId: creator.id, event: 'tiktok_oauth_started' }, 'TikTok OAuth started');
    return `https://www.tiktok.com/v2/auth/authorize/?${query}`;
  }

  async handleCallback(code: string, state: string) {
    assertConfig();
    const saved = await repository.consumeOAuthState(state);
    if (!saved || new Date(saved.expires_at).getTime() <= Date.now()) throw new TikTokAuthorizationError('Esta conexão expirou. Tente conectar o TikTok novamente.');
    const creator = await findCreatorByUserId(saved.user_id);
    if (!creator) throw new TikTokAuthorizationError();
    try {
      const tokens = await this.client.exchangeAuthorizationCode(code);
      const grantedScopes = new Set(tokens.scope.split(',').map((scope) => scope.trim()));
      if (!grantedScopes.has('user.info.basic') || !grantedScopes.has('video.publish')) {
        throw new TikTokAuthorizationError('Autorize as permissões solicitadas para conectar e publicar no TikTok.');
      }
      const profile = await this.client.getUserInfo(tokens.access_token).catch(() => ({
        open_id: tokens.open_id,
        display_name: undefined,
        avatar_url: undefined,
      }));
      const account = await repository.upsertAccount({
        creator_id: creator.id,
        open_id: tokens.open_id,
        display_name: profile.display_name || null,
        avatar_url: profile.avatar_url || null,
        access_token_encrypted: encryptToken(tokens.access_token),
        refresh_token_encrypted: encryptToken(tokens.refresh_token),
        scope: tokens.scope,
        token_type: tokens.token_type || 'Bearer',
        status: 'active',
        ...tokenDates(tokens),
      });
      logger.info({ creatorId: creator.id, tiktokAccountId: account.id, event: 'tiktok_oauth_success' }, 'TikTok account connected');
      logger.info({ creatorId: creator.id, tiktokAccountId: account.id, event: 'tiktok_account_connected' }, 'TikTok account connected');
      return account;
    } catch (error) {
      logger.warn({ creatorId: creator.id, event: 'tiktok_oauth_failed', errorName: error instanceof Error ? error.name : 'Unknown' }, 'TikTok OAuth failed');
      throw error;
    }
  }

  async getAccountForUser(userId: string) {
    const creator = await findCreatorByUserId(userId);
    if (!creator) throw new TikTokNotConnectedError();
    const account = await repository.findAccountByCreator(creator.id);
    if (!account || account.status !== 'active') return { connected: false as const };
    return { connected: true as const, username: account.username, displayName: account.display_name, avatarUrl: account.avatar_url, status: account.status };
  }

  async disconnect(userId: string) {
    const creator = await findCreatorByUserId(userId);
    if (!creator) throw new TikTokNotConnectedError();
    const account = await repository.findAccountByCreator(creator.id);
    if (!account || account.status !== 'active') throw new TikTokNotConnectedError();
    const accessToken = decryptToken(account.access_token_encrypted);
    await this.client.revokeAccessToken(accessToken).catch(() => undefined);
    await repository.updateAccount(account.id, { status: 'revoked', access_token_encrypted: encryptToken(''), refresh_token_encrypted: encryptToken('') });
    logger.info({ creatorId: creator.id, tiktokAccountId: account.id, event: 'tiktok_account_revoked' }, 'TikTok account disconnected');
  }

  async activeAccount(creatorId: string): Promise<TikTokAccount> {
    const account = await repository.findAccountByCreator(creatorId);
    if (!account || account.status !== 'active') throw new TikTokNotConnectedError();
    return account;
  }

  private async refresh(account: TikTokAccount) {
    try {
      const tokens = await this.client.refreshAccessToken(decryptToken(account.refresh_token_encrypted));
      return repository.updateAccount(account.id, {
        open_id: tokens.open_id || account.open_id,
        access_token_encrypted: encryptToken(tokens.access_token),
        refresh_token_encrypted: encryptToken(tokens.refresh_token),
        scope: tokens.scope,
        token_type: tokens.token_type || account.token_type,
        status: 'active',
        ...tokenDates(tokens),
      });
    } catch {
      await repository.updateAccount(account.id, { status: 'error' });
      throw new TikTokTokenExpiredError();
    }
  }

  async withAccessToken<T>(creatorId: string, operation: (token: string, account: TikTokAccount) => Promise<T>): Promise<T> {
    let account = await this.activeAccount(creatorId);
    if (new Date(account.access_token_expires_at).getTime() - Date.now() <= REFRESH_WINDOW_MS) account = await this.refresh(account);
    try {
      return await operation(decryptToken(account.access_token_encrypted), account);
    } catch (error) {
      if (!(error instanceof TikTokTokenExpiredError)) throw error;
      account = await this.refresh(account);
      return operation(decryptToken(account.access_token_encrypted), account);
    }
  }
}

