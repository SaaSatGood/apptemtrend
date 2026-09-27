import { supabaseAdmin } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';
import type { CreatorContent } from '../../types/index.js';

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

export async function listCreatorContent(creatorId: string): Promise<any[]> {
  const { data, error } = await supabaseAdmin
    .from('creator_content')
    .select('*, products(*), content_kits(*)')
    .eq('creator_id', creatorId)
    .order('criado_em', { ascending: false });

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
    .single();

  if (error && error.code !== 'PGRST116') {
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
    .maybeSingle();

  if (error) {
    logger.error({ err: error }, 'Error checking saved product');
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

export async function countByStatus(status: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('creator_content')
    .select('*', { count: 'exact', head: true })
    .eq('status', status);

  if (error) {
    logger.error({ err: error }, 'Error counting by status');
    return 0;
  }

  return count || 0;
}
