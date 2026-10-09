import { supabaseAdmin } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';
import type { ContentKit } from '../../types/index.js';

export async function findContentKitById(id: string): Promise<ContentKit | null> {
  const { data, error } = await supabaseAdmin
    .from('content_kits')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') {
    logger.error({ err: error }, 'Error finding content kit');
    throw error;
  }

  return data;
}

export async function listContentKitsByProductId(productId: string, creatorId?: string): Promise<ContentKit[]> {
  let query = supabaseAdmin
    .from('content_kits')
    .select('*')
    .eq('product_id', productId);

  if (creatorId) query = query.eq('creator_id', creatorId);

  const { data, error } = await query.order('criado_em', { ascending: false });

  if (error) {
    logger.error({ err: error }, 'Error listing content kits');
    throw error;
  }

  return data || [];
}

export async function createContentKit(
  productId: string,
  input: Record<string, unknown>,
  ownership?: { creatorId?: string; briefing?: string },
): Promise<ContentKit> {
  const { data, error } = await supabaseAdmin
    .from('content_kits')
    .insert({
      ...input,
      product_id: productId,
      creator_id: ownership?.creatorId ?? null,
      briefing_usuario: ownership?.briefing || null,
    })
    .select()
    .single();

  if (error) {
    logger.error({ err: error }, 'Error creating content kit');
    throw error;
  }

  return data;
}

export async function updateContentKit(id: string, input: Record<string, unknown>): Promise<ContentKit> {
  const { data, error } = await supabaseAdmin
    .from('content_kits')
    .update(input)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    logger.error({ err: error }, 'Error updating content kit');
    throw error;
  }

  return data;
}
