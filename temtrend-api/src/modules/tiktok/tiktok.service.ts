import crypto from 'node:crypto';
import { rm } from 'node:fs/promises';
import { logger } from '../../lib/logger.js';
import { Errors } from '../../types/index.js';
import { findCreatorByUserId } from '../creators/creator.repository.js';
import { TikTokNotConnectedError } from './tiktok.errors.js';
import * as repository from './tiktok.repository.js';
import { uploadToPrivateStorage, writeAndValidateIncomingVideo } from './tiktok.video.service.js';
import type { IncomingVideo, TikTokClient } from './tiktok.types.js';
import { TikTokOAuthService } from './tiktok.oauth.service.js';

function normalizeHashtag(value: string) {
  const trimmed = value.trim();
  return trimmed ? (trimmed.startsWith('#') ? trimmed : `#${trimmed}`) : '';
}

export function buildCaption(contentKit: any) {
  const copy = String(contentKit?.copy || '').trim();
  const hashtags = Array.isArray(contentKit?.hashtags) ? contentKit.hashtags.map(normalizeHashtag).filter(Boolean).join(' ') : '';
  return [copy, hashtags].filter(Boolean).join('\n\n').slice(0, 2200);
}

export class TikTokService {
  constructor(private client: TikTokClient, private oauth: TikTokOAuthService) {}

  async getCreatorInfo(userId: string) {
    const creator = await findCreatorByUserId(userId);
    if (!creator) throw new TikTokNotConnectedError();
    return this.oauth.withAccessToken(creator.id, (token) => this.client.getCreatorInfo(token));
  }

  async createPost(userId: string, creatorContentId: string, video: IncomingVideo) {
    const owned = await repository.findCreatorContentForUser(userId, creatorContentId);
    if (!owned) throw Errors.NOT_FOUND('Conteúdo');
    const account = await this.oauth.activeAccount(owned.creator.id);
    const activePost = await repository.findActivePostForContent(creatorContentId);
    if (activePost) throw Errors.CONFLICT('Este vídeo já está sendo preparado ou publicado.');
    const creatorInfo = await this.oauth.withAccessToken(owned.creator.id, (token) => this.client.getCreatorInfo(token));
    logger.info({ creatorId: owned.creator.id, creatorContentId, event: 'tiktok_upload_started' }, 'TikTok video upload started');
    const local = await writeAndValidateIncomingVideo(video, creatorInfo);
    const storagePath = `${owned.creator.id}/${creatorContentId}/${crypto.randomUUID()}${local.extension}`;
    let stored = false;
    try {
      await uploadToPrivateStorage(local.tempPath, storagePath, video.mimeType, local.size);
      stored = true;
      const post = await repository.createPost({
        creator_id: owned.creator.id,
        creator_content_id: creatorContentId,
        content_kit_id: owned.content.content_kit_id || null,
        tiktok_account_id: account.id,
        storage_path: storagePath,
        file_size: local.size,
        mime_type: video.mimeType,
        caption: buildCaption(owned.content.content_kits),
        status: 'pending',
      });
      await repository.updateCreatorContentAfterUpload(creatorContentId);
      logger.info({ creatorId: owned.creator.id, tiktokPostId: post.id, event: 'tiktok_upload_completed' }, 'TikTok video stored');
      return { id: post.id, status: post.status };
    } catch (error) {
      if (stored) await repository.removeStoredVideo(storagePath).catch(() => undefined);
      throw error;
    } finally {
      await rm(local.tempPath, { force: true });
    }
  }

  async getPost(userId: string, postId: string) {
    const creator = await findCreatorByUserId(userId);
    if (!creator) throw Errors.NOT_FOUND('Creator');
    const post = await repository.findPostForCreator(postId, creator.id);
    if (!post) throw Errors.NOT_FOUND('Vídeo');
    const account = await repository.findAccountByCreator(creator.id);
    const previewUrl = await repository.createPreviewUrl(post.storage_path);
    return {
      id: post.id,
      status: post.status,
      previewUrl,
      caption: post.caption || '',
      hashtags: (post.caption || '').match(/#[\p{L}\p{N}_]+/gu) || [],
      tiktokAccount: account ? { username: account.username, displayName: account.display_name, avatarUrl: account.avatar_url } : null,
      privacyLevel: post.privacy_level,
      errorMessage: post.status === 'failed' ? post.error_message : null,
      createdAt: post.created_at,
      publishedAt: post.published_at,
    };
  }
}

