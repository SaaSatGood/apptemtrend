import { supabaseAdmin } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';
import type { ContentKit, CreatorContent, Product } from '../../types/index.js';

export interface CreatorContentWithRelations extends CreatorContent {
  products: Product | null;
  content_kits: ContentKit | null;
}

export async function findCreatorContentById(id: string): Promise<CreatorContent | null> {
  const { data, error } = await supabaseAdmin
    .from('creator_content')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') {
    logger.error({ err: error }, 'Error finding creator content');
    throw error;
  }

  return data;
}

export async function findCreatorContentWithRelationsById(id: string): Promise<CreatorContentWithRelations | null> {
  const { data, error } = await supabaseAdmin
    .from('creator_content')
    .select('*, products(*), content_kits(*)')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    logger.error({ err: error }, 'Error finding creator content with relations');
    throw error;
  }

  return data;
}

export async function listCreatorContent(
  creatorId: string,
  options?: { limit?: number; offset?: number },
): Promise<CreatorContentWithRelations[]> {
  let query = supabaseAdmin
    .from('creator_content')
    .select('*, products(*), content_kits(*)')
    .eq('creator_id', creatorId)
    .order('criado_em', { ascending: false });

  if (options?.limit !== undefined) {
    const from = options.offset ?? 0;
    query = query.range(from, from + options.limit - 1);
  }

  const { data, error } = await query;

  if (error) {
    logger.error({ err: error }, 'Error listing creator content');
    throw error;
  }

  return data || [];
}

export async function findByCreatorAndKit(creatorId: string, contentKitId: string): Promise<CreatorContent | null> {
  const { data, error } = await supabaseAdmin
    .from('creator_content')
    .select('*')
    .eq('creator_id', creatorId)
    .eq('content_kit_id', contentKitId)
    .maybeSingle();

  if (error) {
    logger.error({ err: error }, 'Error checking duplicate creator content');
    throw error;
  }

  return data;
}

export async function findByCreatorAndProduct(creatorId: string, productId: string): Promise<CreatorContent | null> {
  const { data, error } = await supabaseAdmin
    .from('creator_content')
    .select('*')
    .eq('creator_id', creatorId)
    .eq('product_id', productId)
    .is('content_kit_id', null)
    .maybeSingle();

  if (error) {
    logger.error({ err: error }, 'Error checking saved product');
    throw error;
  }

  return data;
}

export async function findAnyByCreatorAndProduct(creatorId: string, productId: string): Promise<CreatorContent | null> {
  const { data, error } = await supabaseAdmin
    .from('creator_content')
    .select('*')
    .eq('creator_id', creatorId)
    .eq('product_id', productId)
    .order('atualizado_em', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.error({ err: error }, 'Error checking product production');
    throw error;
  }

  return data;
}

export async function createCreatorContent(input: {
  creator_id: string;
  product_id?: string;
  content_kit_id?: string;
  status: string;
}): Promise<CreatorContent> {
  const { data, error } = await supabaseAdmin
    .from('creator_content')
    .insert(input)
    .select()
    .single();

  if (error) {
    logger.error({ err: error }, 'Error creating creator content');
    throw error;
  }

  return data;
}

export async function updateCreatorContent(id: string, input: Record<string, unknown>): Promise<CreatorContent> {
  const { data, error } = await supabaseAdmin
    .from('creator_content')
    .update(input)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    logger.error({ err: error }, 'Error updating creator content');
    throw error;
  }

  return data;
}
