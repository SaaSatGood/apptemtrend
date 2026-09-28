import path from 'node:path';
import { rm } from 'node:fs/promises';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { Errors } from '../../types/index.js';
import { findCreatorByUserId } from '../creators/creator.repository.js';
import { calculateChunks } from './tiktok.api-client.js';
import { TikTokPrivacyError, TikTokPublishError } from './tiktok.errors.js';
import { TikTokOAuthService } from './tiktok.oauth.service.js';
import * as repository from './tiktok.repository.js';
import type { PublishInput } from './tiktok.schemas.js';
import type { TikTokClient } from './tiktok.types.js';
import { downloadSignedVideo } from './tiktok.video.service.js';

export function mapTikTokPublishStatus(status: string): 'processing' | 'published' | 'failed' {
  if (status === 'PUBLISH_COMPLETE') return 'published';
  if (status === 'FAILED') return 'failed';
  return 'processing';
}

export class TikTokPublishService {
  constructor(private client: TikTokClient, private oauth: TikTokOAuthService) {}

  async publish(userId: string, postId: string, input: PublishInput) {
    const creator = await findCreatorByUserId(userId);
    if (!creator) throw Errors.NOT_FOUND('Creator');
    const current = await repository.findPostForCreator(postId, creator.id);
    if (!current) throw Errors.NOT_FOUND('Vídeo');
    if (current.status === 'published') throw Errors.CONFLICT('Este vídeo já foi publicado.');
    if (current.status === 'uploading' || current.status === 'processing') throw Errors.CONFLICT('Este vídeo já está sendo publicado.');
    const caption = input.caption ?? current.caption ?? '';
    if (caption.length > 2200) throw Errors.BAD_REQUEST('A legenda deve ter no máximo 2200 caracteres.');

    const preparation = await this.oauth.withAccessToken(creator.id, async (token, account) => {
      const info = await this.client.getCreatorInfo(token);
      if (!info.privacy_level_options.includes(input.privacyLevel)) throw new TikTokPrivacyError();
      await repository.updateAccount(account.id, {
        username: info.creator_username || account.username,
        display_name: info.creator_nickname || account.display_name,
        avatar_url: info.creator_avatar_url || account.avatar_url,
      });
      return { account, info };
    });

    const claimed = await repository.claimPost(postId, creator.id);
    if (!claimed) throw Errors.CONFLICT('Este vídeo já está sendo publicado.');
    let localPath: string | null = null;
    try {
      logger.info({ creatorId: creator.id, tiktokPostId: postId, event: 'tiktok_publish_started' }, 'TikTok publish started');
      await repository.updatePost(postId, { caption, privacy_level: input.privacyLevel, attempt_count: claimed.attempt_count + 1 });
      const chunkPlan = calculateChunks(claimed.file_size, env.TIKTOK_UPLOAD_CHUNK_SIZE);
      const initialized = await this.oauth.withAccessToken(creator.id, (token) => this.client.initializeVideoPost(token, {
          caption,
          privacyLevel: input.privacyLevel,
          disableComment: preparation.info.comment_disabled || input.disableComment,
          disableDuet: preparation.info.duet_disabled || input.disableDuet,
          disableStitch: preparation.info.stitch_disabled || input.disableStitch,
          coverTimestampMs: input.coverTimestampMs,
          videoSize: claimed.file_size,
          ...chunkPlan,
        }));
      await repository.updatePost(postId, { publish_id: initialized.publishId });
      const signedUrl = await repository.createPreviewUrl(claimed.storage_path);
      localPath = await downloadSignedVideo(signedUrl, path.extname(claimed.storage_path));
      await this.client.uploadVideo(initialized.uploadUrl, localPath, claimed.mime_type, claimed.file_size, env.TIKTOK_UPLOAD_CHUNK_SIZE);
      const updated = await repository.updatePost(postId, { status: 'processing' });
      logger.info({ creatorId: creator.id, tiktokPostId: postId, publishId: initialized.publishId, event: 'tiktok_publish_processing' }, 'TikTok publish processing');
      return { id: updated.id, status: updated.status };
    } catch (error) {
      await repository.updatePost(postId, { status: 'failed', error_code: error instanceof Error ? error.name : 'TIKTOK_PUBLISH_ERROR', error_message: 'Não conseguimos publicar seu vídeo.' }).catch(() => undefined);
      logger.warn({ creatorId: creator.id, tiktokPostId: postId, event: 'tiktok_publish_failed', errorName: error instanceof Error ? error.name : 'Unknown' }, 'TikTok publish failed');
      throw error instanceof Error ? error : new TikTokPublishError();
    } finally {
      if (localPath) await rm(localPath, { force: true });
    }
  }

  async refreshStatus(userId: string, postId: string) {
    const creator = await findCreatorByUserId(userId);
    if (!creator) throw Errors.NOT_FOUND('Creator');
    const post = await repository.findPostForCreator(postId, creator.id);
    if (!post) throw Errors.NOT_FOUND('Vídeo');
    if (post.status === 'published' || post.status === 'failed') return { id: post.id, status: post.status };
    if (!post.publish_id) throw Errors.CONFLICT('A publicação ainda não foi iniciada.');
    const result = await this.oauth.withAccessToken(creator.id, (token) => this.client.fetchPublishStatus(token, post.publish_id!));
    const mapped = mapTikTokPublishStatus(result.status);
    if (mapped === 'published') {
      const tiktokPostId = result.postIds[0] || null;
      const updated = await repository.updatePost(post.id, { status: 'published', tiktok_post_id: tiktokPostId, error_code: null, error_message: null, published_at: new Date().toISOString() });
      if (post.creator_content_id) await repository.updateCreatorContentPublished(post.creator_content_id);
      logger.info({ creatorId: creator.id, tiktokPostId: post.id, publishId: post.publish_id, event: 'tiktok_publish_completed' }, 'TikTok publish completed');
      return { id: updated.id, status: updated.status, publishedUrl: null };
    }
    if (mapped === 'failed') {
      const updated = await repository.updatePost(post.id, { status: 'failed', error_code: result.failReason || 'TIKTOK_PROCESSING_FAILED', error_message: 'O TikTok não conseguiu processar este vídeo.' });
      logger.warn({ creatorId: creator.id, tiktokPostId: post.id, publishId: post.publish_id, event: 'tiktok_publish_failed' }, 'TikTok processing failed');
      return { id: updated.id, status: updated.status };
    }
    return { id: post.id, status: 'processing' as const };
  }
}

