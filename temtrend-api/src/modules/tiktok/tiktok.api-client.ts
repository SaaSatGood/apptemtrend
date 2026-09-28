import { open } from 'node:fs/promises';
import { env } from '../../config/env.js';
import { mapTikTokError, TikTokAuthorizationError, TikTokConfigurationError, TikTokUploadError } from './tiktok.errors.js';
import type { TikTokClient, TikTokCreatorInfo, TikTokTokenBundle } from './tiktok.types.js';

const API = 'https://open.tiktokapis.com';
const MAX_SINGLE_CHUNK = 64 * 1024 * 1024;

function credentials() {
  if (!env.TIKTOK_CLIENT_KEY || !env.TIKTOK_CLIENT_SECRET || !env.TIKTOK_REDIRECT_URI) {
    throw new TikTokConfigurationError();
  }
  return {
    clientKey: env.TIKTOK_CLIENT_KEY,
    clientSecret: env.TIKTOK_CLIENT_SECRET,
    redirectUri: env.TIKTOK_REDIRECT_URI,
  };
}

async function jsonResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as any;
  const apiCode = body?.error?.code || body?.error;
  if (!response.ok || (apiCode && apiCode !== 'ok')) throw mapTikTokError(response.status, apiCode);
  return body as T;
}

export function calculateChunks(fileSize: number, configuredSize: number) {
  if (fileSize <= MAX_SINGLE_CHUNK) return { chunkSize: fileSize, totalChunkCount: 1 };
  let chunkSize = configuredSize;
  let totalChunkCount = Math.floor(fileSize / chunkSize);
  if (totalChunkCount < 2) {
    totalChunkCount = 2;
    chunkSize = Math.floor(fileSize / 2);
  }
  if (totalChunkCount > 1000) throw new TikTokUploadError();
  return { chunkSize, totalChunkCount };
}

export class TikTokApiClient implements TikTokClient {
  async exchangeAuthorizationCode(code: string): Promise<TikTokTokenBundle> {
    const config = credentials();
    const body = new URLSearchParams({
      client_key: config.clientKey,
      client_secret: config.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri,
    });
    const response = await fetch(`${API}/v2/oauth/token/`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body, signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new TikTokAuthorizationError();
    const result = await response.json() as TikTokTokenBundle & { error?: string };
    if (result.error || !result.access_token || !result.refresh_token) throw new TikTokAuthorizationError();
    return result;
  }

  async refreshAccessToken(refreshToken: string): Promise<TikTokTokenBundle> {
    const config = credentials();
    const body = new URLSearchParams({ client_key: config.clientKey, client_secret: config.clientSecret, grant_type: 'refresh_token', refresh_token: refreshToken });
    const response = await fetch(`${API}/v2/oauth/token/`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body, signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new TikTokAuthorizationError('TikTok precisa ser conectado novamente.');
    const result = await response.json() as TikTokTokenBundle & { error?: string };
    if (result.error || !result.access_token || !result.refresh_token) throw new TikTokAuthorizationError('TikTok precisa ser conectado novamente.');
    return result;
  }

  async revokeAccessToken(accessToken: string): Promise<void> {
    const config = credentials();
    const body = new URLSearchParams({ client_key: config.clientKey, client_secret: config.clientSecret, token: accessToken });
    const response = await fetch(`${API}/v2/oauth/revoke/`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body, signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new TikTokAuthorizationError('Não conseguimos desconectar o TikTok agora.');
  }

  async getUserInfo(accessToken: string) {
    const response = await fetch(`${API}/v2/user/info/?fields=open_id,avatar_url,display_name`, { headers: { authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15_000) });
    const result = await jsonResponse<{ data?: { user?: { open_id?: string; avatar_url?: string; display_name?: string } } }>(response);
    return result.data?.user || {};
  }

  async getCreatorInfo(accessToken: string): Promise<TikTokCreatorInfo> {
    const response = await fetch(`${API}/v2/post/publish/creator_info/query/`, { method: 'POST', headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json; charset=UTF-8' }, body: '{}', signal: AbortSignal.timeout(15_000) });
    const result = await jsonResponse<{ data: TikTokCreatorInfo }>(response);
    return result.data;
  }

  async initializeVideoPost(accessToken: string, input: Parameters<TikTokClient['initializeVideoPost']>[1]) {
    const response = await fetch(`${API}/v2/post/publish/video/init/`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({
        post_info: {
          title: input.caption,
          privacy_level: input.privacyLevel,
          disable_comment: input.disableComment,
          disable_duet: input.disableDuet,
          disable_stitch: input.disableStitch,
          video_cover_timestamp_ms: input.coverTimestampMs,
        },
        source_info: { source: 'FILE_UPLOAD', video_size: input.videoSize, chunk_size: input.chunkSize, total_chunk_count: input.totalChunkCount },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const result = await jsonResponse<{ data: { publish_id: string; upload_url: string } }>(response);
    return { publishId: result.data.publish_id, uploadUrl: result.data.upload_url };
  }

  async uploadVideo(uploadUrl: string, filePath: string, mimeType: string, fileSize: number, configuredChunkSize: number) {
    const { chunkSize, totalChunkCount } = calculateChunks(fileSize, configuredChunkSize);
    const file = await open(filePath, 'r');
    try {
      let start = 0;
      for (let index = 0; index < totalChunkCount; index += 1) {
        const isLast = index === totalChunkCount - 1;
        const length = isLast ? fileSize - start : chunkSize;
        const buffer = Buffer.allocUnsafe(length);
        const { bytesRead } = await file.read(buffer, 0, length, start);
        if (bytesRead !== length) throw new TikTokUploadError();
        const end = start + length - 1;
        const response = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'content-type': mimeType, 'content-length': String(length), 'content-range': `bytes ${start}-${end}/${fileSize}` },
          body: buffer,
          signal: AbortSignal.timeout(120_000),
        });
        if (!response.ok) throw new TikTokUploadError();
        start = end + 1;
      }
    } finally {
      await file.close();
    }
  }

  async fetchPublishStatus(accessToken: string, publishId: string) {
    const response = await fetch(`${API}/v2/post/publish/status/fetch/`, { method: 'POST', headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json; charset=UTF-8' }, body: JSON.stringify({ publish_id: publishId }), signal: AbortSignal.timeout(15_000) });
    const result = await jsonResponse<{ data: { status: string; fail_reason?: string; publicaly_available_post_id?: string[] } }>(response);
    return { status: result.data.status, failReason: result.data.fail_reason, postIds: result.data.publicaly_available_post_id || [] };
  }
}

