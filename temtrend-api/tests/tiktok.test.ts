import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/modules/creators/creator.repository.js', () => ({
  findCreatorByUserId: vi.fn(),
}));

vi.mock('../src/modules/tiktok/tiktok.repository.js', () => ({
  createOAuthState: vi.fn(),
  consumeOAuthState: vi.fn(),
  upsertAccount: vi.fn(),
  findAccountByCreator: vi.fn(),
  findCreatorContentForUser: vi.fn(),
  findActivePostForContent: vi.fn(),
  findPostForCreator: vi.fn(),
  claimPost: vi.fn(),
  updateAccount: vi.fn(),
  updatePost: vi.fn(),
  updateCreatorContentPublished: vi.fn(),
}));

import { env } from '../src/config/env.js';
import { findCreatorByUserId } from '../src/modules/creators/creator.repository.js';
import { calculateChunks } from '../src/modules/tiktok/tiktok.api-client.js';
import { decryptToken, encryptToken } from '../src/modules/tiktok/tiktok.crypto.js';
import { mapTikTokError, TikTokPrivacyError, TikTokRateLimitError, TikTokTokenExpiredError, TikTokVideoValidationError } from '../src/modules/tiktok/tiktok.errors.js';
import { TikTokOAuthService } from '../src/modules/tiktok/tiktok.oauth.service.js';
import { mapTikTokPublishStatus, TikTokPublishService } from '../src/modules/tiktok/tiktok.publish.service.js';
import * as repository from '../src/modules/tiktok/tiktok.repository.js';
import { publishSchema } from '../src/modules/tiktok/tiktok.schemas.js';
import { buildCaption, TikTokService } from '../src/modules/tiktok/tiktok.service.js';
import { validateProbe } from '../src/modules/tiktok/tiktok.video.service.js';

const originalKey = env.TIKTOK_TOKEN_ENCRYPTION_KEY;
const originalClientKey = env.TIKTOK_CLIENT_KEY;
const originalClientSecret = env.TIKTOK_CLIENT_SECRET;
const originalRedirect = env.TIKTOK_REDIRECT_URI;
const creator = { id: '11111111-1111-4111-8111-111111111111', user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };

describe('TikTok integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    env.TIKTOK_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
    env.TIKTOK_CLIENT_KEY = 'client-key';
    env.TIKTOK_CLIENT_SECRET = 'client-secret';
    env.TIKTOK_REDIRECT_URI = 'http://localhost:3333/tiktok/callback';
  });

  afterEach(() => {
    env.TIKTOK_TOKEN_ENCRYPTION_KEY = originalKey;
    env.TIKTOK_CLIENT_KEY = originalClientKey;
    env.TIKTOK_CLIENT_SECRET = originalClientSecret;
    env.TIKTOK_REDIRECT_URI = originalRedirect;
  });

  it('creates a short-lived one-time OAuth state tied to the authenticated user', async () => {
    vi.mocked(findCreatorByUserId).mockResolvedValue(creator as any);
    const oauth = new TikTokOAuthService({} as any);
    const url = new URL(await oauth.createAuthorizationUrl(creator.user_id));
    expect(url.origin + url.pathname).toBe('https://www.tiktok.com/v2/auth/authorize/');
    expect(url.searchParams.get('scope')).toBe('user.info.basic,video.publish');
    expect(url.searchParams.get('state')).toHaveLength(43);
    expect(repository.createOAuthState).toHaveBeenCalledWith(creator.user_id, url.searchParams.get('state'), expect.any(Date));
  });

  it('rejects an invalid or expired OAuth state before token exchange', async () => {
    const exchangeAuthorizationCode = vi.fn();
    const oauth = new TikTokOAuthService({ exchangeAuthorizationCode } as any);
    vi.mocked(repository.consumeOAuthState).mockResolvedValueOnce(null);
    await expect(oauth.handleCallback('code', 'invalid-state')).rejects.toMatchObject({ code: 'TIKTOK_AUTHORIZATION_ERROR' });
    vi.mocked(repository.consumeOAuthState).mockResolvedValueOnce({ user_id: creator.user_id, expires_at: new Date(Date.now() - 1000).toISOString() });
    await expect(oauth.handleCallback('code', 'expired-state')).rejects.toMatchObject({ code: 'TIKTOK_AUTHORIZATION_ERROR' });
    expect(exchangeAuthorizationCode).not.toHaveBeenCalled();
  });

  it('exchanges a valid code and persists encrypted tokens without returning them to the frontend model', async () => {
    vi.mocked(repository.consumeOAuthState).mockResolvedValue({ user_id: creator.user_id, expires_at: new Date(Date.now() + 60_000).toISOString() });
    vi.mocked(findCreatorByUserId).mockResolvedValue(creator as any);
    vi.mocked(repository.upsertAccount).mockImplementation(async (input: any) => ({ id: 'account', creator_id: creator.id, ...input }));
    const client = {
      exchangeAuthorizationCode: vi.fn().mockResolvedValue({ open_id: 'open', access_token: 'access-secret', refresh_token: 'refresh-secret', scope: 'user.info.basic,video.publish', expires_in: 3600, refresh_expires_in: 86400, token_type: 'Bearer' }),
      getUserInfo: vi.fn().mockResolvedValue({ display_name: 'Creator' }),
    };
    const account = await new TikTokOAuthService(client as any).handleCallback('valid-code', 'valid-state');
    expect(client.exchangeAuthorizationCode).toHaveBeenCalledWith('valid-code');
    expect(account.access_token_encrypted).not.toContain('access-secret');
    expect(account.refresh_token_encrypted).not.toContain('refresh-secret');
  });

  it('refreshes a near-expired token once and replaces the rotated refresh token', async () => {
    const account = { id: 'account', creator_id: creator.id, open_id: 'open', username: null, display_name: null, avatar_url: null, access_token_encrypted: encryptToken('old-access'), refresh_token_encrypted: encryptToken('old-refresh'), scope: 'video.publish', access_token_expires_at: new Date(Date.now() - 1000).toISOString(), refresh_token_expires_at: null, token_type: 'Bearer', status: 'active' as const };
    vi.mocked(repository.findAccountByCreator).mockResolvedValue(account);
    vi.mocked(repository.updateAccount).mockImplementation(async (_id, input: any) => ({ ...account, ...input }));
    const client = { refreshAccessToken: vi.fn().mockResolvedValue({ open_id: 'open', access_token: 'new-access', refresh_token: 'new-refresh', scope: 'video.publish', expires_in: 3600, refresh_expires_in: 86400, token_type: 'Bearer' }) };
    const operation = vi.fn().mockResolvedValue('ok');
    await expect(new TikTokOAuthService(client as any).withAccessToken(creator.id, operation)).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledWith('new-access', expect.any(Object));
    expect(decryptToken((vi.mocked(repository.updateAccount).mock.calls[0]![1] as any).refresh_token_encrypted)).toBe('new-refresh');
  });

  it('encrypts tokens with authenticated encryption and rejects tampering', () => {
    const encrypted = encryptToken('access-token-secret');
    expect(encrypted).not.toContain('access-token-secret');
    expect(decryptToken(encrypted)).toBe('access-token-secret');
    const parts = encrypted.split('.');
    const tampered = Buffer.from(parts[3]!, 'base64url');
    tampered[0] = tampered[0]! ^ 1;
    parts[3] = tampered.toString('base64url');
    expect(() => decryptToken(parts.join('.'))).toThrow();
  });

  it('builds a TikTok-compliant chunk plan', () => {
    expect(calculateChunks(4 * 1024 * 1024, 10 * 1024 * 1024)).toEqual({ chunkSize: 4 * 1024 * 1024, totalChunkCount: 1 });
    expect(calculateChunks(25 * 1024 * 1024, 10 * 1024 * 1024)).toEqual({ chunkSize: 25 * 1024 * 1024, totalChunkCount: 1 });
    expect(calculateChunks(100 * 1024 * 1024, 10 * 1024 * 1024)).toEqual({ chunkSize: 10 * 1024 * 1024, totalChunkCount: 10 });
  });

  it('normalizes the Content Kit caption and enforces the limit', () => {
    const caption = buildCaption({ copy: 'Testei e gostei.', hashtags: ['achadinhos', '#review'] });
    expect(caption).toBe('Testei e gostei.\n\n#achadinhos #review');
    expect(buildCaption({ copy: 'x'.repeat(2300) })).toHaveLength(2200);
  });

  it('validates publish fields and privacy selection input', () => {
    expect(publishSchema.safeParse({ privacyLevel: 'SELF_ONLY' }).success).toBe(true);
    expect(publishSchema.safeParse({ privacyLevel: '', unknown: true }).success).toBe(false);
    expect(publishSchema.safeParse({ privacyLevel: 'SELF_ONLY', caption: 'x'.repeat(2201) }).success).toBe(false);
  });

  it('validates codec, dimensions, fps and creator duration limit', () => {
    const info = { privacy_level_options: ['SELF_ONLY'], comment_disabled: false, duet_disabled: false, stitch_disabled: false, max_video_post_duration_sec: 60 };
    expect(() => validateProbe({ codec: 'h264', width: 1080, height: 1920, fps: 30, durationSec: 59 }, info)).not.toThrow();
    expect(() => validateProbe({ codec: 'mpeg2video', width: 1080, height: 1920, fps: 30, durationSec: 59 }, info)).toThrow(TikTokVideoValidationError);
    expect(() => validateProbe({ codec: 'h264', width: 1080, height: 1920, fps: 30, durationSec: 61 }, info)).toThrow(TikTokVideoValidationError);
  });

  it('maps TikTok auth, rate-limit and privacy failures to safe domain errors', () => {
    expect(mapTikTokError(401)).toBeInstanceOf(TikTokTokenExpiredError);
    expect(mapTikTokError(429)).toBeInstanceOf(TikTokRateLimitError);
    expect(mapTikTokError(400, 'unaudited_client_can_only_post_to_private_accounts')).toBeInstanceOf(TikTokPrivacyError);
  });

  it('maps asynchronous publication statuses without inventing a public URL', () => {
    expect(mapTikTokPublishStatus('PROCESSING_UPLOAD')).toBe('processing');
    expect(mapTikTokPublishStatus('PUBLISH_COMPLETE')).toBe('published');
    expect(mapTikTokPublishStatus('FAILED')).toBe('failed');
  });

  it('rejects upload when creator_content is not owned by the authenticated creator', async () => {
    vi.mocked(repository.findCreatorContentForUser).mockResolvedValue(null);
    const service = new TikTokService({} as any, {} as any);
    await expect(service.createPost(creator.user_id, '22222222-2222-4222-8222-222222222222', {} as any))
      .rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND', statusCode: 404 });
  });

  it('prevents a second concurrent publication claim', async () => {
    vi.mocked(findCreatorByUserId).mockResolvedValue(creator as any);
    vi.mocked(repository.findPostForCreator).mockResolvedValue({ id: 'post', creator_id: creator.id, status: 'pending', caption: '', attempt_count: 0 } as any);
    vi.mocked(repository.claimPost).mockResolvedValue(null);
    const oauth = { withAccessToken: vi.fn(async (_id, operation) => operation('token', { id: 'account' })) };
    const client = { getCreatorInfo: vi.fn().mockResolvedValue({ privacy_level_options: ['SELF_ONLY'], comment_disabled: false, duet_disabled: false, stitch_disabled: false, max_video_post_duration_sec: 60 }) };
    const publisher = new TikTokPublishService(client as any, oauth as any);
    await expect(publisher.publish(creator.user_id, 'post', publishSchema.parse({ privacyLevel: 'SELF_ONLY' })))
      .rejects.toMatchObject({ code: 'CONFLICT', statusCode: 409 });
  });
});
