import { supabaseAdmin } from '../../lib/supabase.js';
import type { TikTokAccount, TikTokPost } from './tiktok.types.js';

function fail(error: any): never { throw error; }

export async function createOAuthState(userId: string, state: string, expiresAt: Date) {
  await supabaseAdmin.from('tiktok_oauth_states').delete().lt('expires_at', new Date().toISOString());
  const { error } = await supabaseAdmin.from('tiktok_oauth_states').insert({ user_id: userId, state, expires_at: expiresAt.toISOString() });
  if (error) fail(error);
}

export async function consumeOAuthState(state: string): Promise<{ user_id: string; expires_at: string } | null> {
  const { data, error } = await supabaseAdmin.from('tiktok_oauth_states').delete().eq('state', state).select('user_id, expires_at').maybeSingle();
  if (error) fail(error);
  return data;
}

export async function findAccountByCreator(creatorId: string): Promise<TikTokAccount | null> {
  const { data, error } = await supabaseAdmin.from('tiktok_accounts').select('*').eq('creator_id', creatorId).maybeSingle();
  if (error) fail(error);
  return data as TikTokAccount | null;
}

export async function upsertAccount(input: Record<string, unknown>): Promise<TikTokAccount> {
  const { data, error } = await supabaseAdmin.from('tiktok_accounts').upsert(input, { onConflict: 'creator_id' }).select('*').single();
  if (error) fail(error);
  return data as TikTokAccount;
}

export async function updateAccount(id: string, input: Record<string, unknown>): Promise<TikTokAccount> {
  const { data, error } = await supabaseAdmin.from('tiktok_accounts').update(input).eq('id', id).select('*').single();
  if (error) fail(error);
  return data as TikTokAccount;
}

export async function findCreatorContentForUser(userId: string, contentId: string) {
  const { data: creator, error: creatorError } = await supabaseAdmin.from('creators').select('id').eq('user_id', userId).maybeSingle();
  if (creatorError) fail(creatorError);
  if (!creator) return null;
  const { data, error } = await supabaseAdmin.from('creator_content').select('*, content_kits(*)').eq('id', contentId).eq('creator_id', creator.id).maybeSingle();
  if (error) fail(error);
  return data ? { creator, content: data } : null;
}

export async function createPost(input: Record<string, unknown>): Promise<TikTokPost> {
  const { data, error } = await supabaseAdmin.from('tiktok_posts').insert(input).select('*').single();
  if (error) fail(error);
  return data as TikTokPost;
}

export async function findActivePostForContent(creatorContentId: string): Promise<TikTokPost | null> {
  const { data, error } = await supabaseAdmin.from('tiktok_posts').select('*')
    .eq('creator_content_id', creatorContentId)
    .in('status', ['pending', 'uploading', 'processing'])
    .maybeSingle();
  if (error) fail(error);
  return data as TikTokPost | null;
}

export async function findPostById(id: string): Promise<TikTokPost | null> {
  const { data, error } = await supabaseAdmin.from('tiktok_posts').select('*').eq('id', id).maybeSingle();
  if (error) fail(error);
  return data as TikTokPost | null;
}

export async function findPostForCreator(id: string, creatorId: string): Promise<TikTokPost | null> {
  const { data, error } = await supabaseAdmin.from('tiktok_posts').select('*').eq('id', id).eq('creator_id', creatorId).maybeSingle();
  if (error) fail(error);
  return data as TikTokPost | null;
}

export async function updatePost(id: string, input: Record<string, unknown>): Promise<TikTokPost> {
  const { data, error } = await supabaseAdmin.from('tiktok_posts').update(input).eq('id', id).select('*').single();
  if (error) fail(error);
  return data as TikTokPost;
}

export async function claimPost(id: string, creatorId: string): Promise<TikTokPost | null> {
  const { data, error } = await supabaseAdmin.from('tiktok_posts')
    .update({ status: 'uploading', error_code: null, error_message: null })
    .eq('id', id).eq('creator_id', creatorId).in('status', ['pending', 'failed'])
    .select('*').maybeSingle();
  if (error) fail(error);
  return data as TikTokPost | null;
}

export async function listAdminPosts() {
  const { data, error } = await supabaseAdmin.from('tiktok_posts')
    .select('id, creator_id, creator_content_id, status, publish_id, tiktok_post_id, error_code, error_message, attempt_count, created_at, published_at, tiktok_accounts(username, display_name)')
    .order('created_at', { ascending: false });
  if (error) fail(error);
  return data || [];
}

export async function createPreviewUrl(storagePath: string) {
  const { data, error } = await supabaseAdmin.storage.from('creator-videos').createSignedUrl(storagePath, 900);
  if (error) fail(error);
  return data.signedUrl;
}

export async function removeStoredVideo(storagePath: string) {
  const { error } = await supabaseAdmin.storage.from('creator-videos').remove([storagePath]);
  if (error) fail(error);
}

export async function updateCreatorContentAfterUpload(id: string) {
  const { error } = await supabaseAdmin.from('creator_content').update({ status: 'gravado' }).eq('id', id).neq('status', 'publicado');
  if (error) fail(error);
}

export async function updateCreatorContentPublished(id: string) {
  const { error } = await supabaseAdmin.from('creator_content').update({ status: 'publicado' }).eq('id', id);
  if (error) fail(error);
}

