import type { Readable } from 'node:stream';

export interface TikTokTokenBundle {
  open_id: string;
  access_token: string;
  refresh_token: string;
  scope: string;
  expires_in: number;
  refresh_expires_in?: number;
  token_type: string;
}

export interface TikTokCreatorInfo {
  creator_avatar_url?: string;
  creator_username?: string;
  creator_nickname?: string;
  privacy_level_options: string[];
  comment_disabled: boolean;
  duet_disabled: boolean;
  stitch_disabled: boolean;
  max_video_post_duration_sec: number;
}

export interface TikTokAccount {
  id: string;
  creator_id: string;
  open_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  scope: string;
  access_token_expires_at: string;
  refresh_token_expires_at: string | null;
  token_type: string;
  status: 'active' | 'revoked' | 'error';
}

export interface TikTokPost {
  id: string;
  creator_id: string;
  creator_content_id: string | null;
  content_kit_id: string | null;
  tiktok_account_id: string;
  storage_path: string;
  file_size: number;
  mime_type: string;
  caption: string | null;
  privacy_level: string | null;
  publish_id: string | null;
  tiktok_post_id: string | null;
  status: 'pending' | 'uploading' | 'processing' | 'published' | 'failed' | 'cancelled';
  error_code: string | null;
  error_message: string | null;
  attempt_count: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface VideoProbe {
  durationSec: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
}

export interface TikTokClient {
  exchangeAuthorizationCode(code: string): Promise<TikTokTokenBundle>;
  refreshAccessToken(refreshToken: string): Promise<TikTokTokenBundle>;
  revokeAccessToken(accessToken: string): Promise<void>;
  getUserInfo(accessToken: string): Promise<{ open_id?: string; display_name?: string; avatar_url?: string }>;
  getCreatorInfo(accessToken: string): Promise<TikTokCreatorInfo>;
  initializeVideoPost(accessToken: string, input: {
    caption: string;
    privacyLevel: string;
    disableComment: boolean;
    disableDuet: boolean;
    disableStitch: boolean;
    coverTimestampMs: number;
    videoSize: number;
    chunkSize: number;
    totalChunkCount: number;
  }): Promise<{ publishId: string; uploadUrl: string }>;
  uploadVideo(uploadUrl: string, filePath: string, mimeType: string, fileSize: number, chunkSize: number): Promise<void>;
  fetchPublishStatus(accessToken: string, publishId: string): Promise<{ status: string; failReason?: string; postIds: string[] }>;
}

export interface IncomingVideo {
  stream: Readable;
  filename: string;
  mimeType: string;
}

