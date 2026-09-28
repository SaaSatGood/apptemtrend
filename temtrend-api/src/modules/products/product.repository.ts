import { supabaseAdmin } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';
import { PRODUCT_STATUS } from '../../config/constants.js';
import type { Product } from '../../types/index.js';

export async function findProductById(id: string): Promise<Product | null> {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') {
    logger.error({ err: error }, 'Error finding product');
    throw error;
  }

  return data;
}

export async function listActiveProducts(filters?: {
  categoria?: string;
  destaque?: boolean;
}): Promise<Product[]> {
  let query = supabaseAdmin
    .from('products')
    .select('*')
    .eq('status', PRODUCT_STATUS.ATIVO);

  if (filters?.categoria) {
    query = query.eq('categoria', filters.categoria);
  }

  if (filters?.destaque !== undefined) {
    query = query.eq('destaque', filters.destaque);
  }

  const { data, error } = await query
    .order('ordem_destaque', { ascending: false })
    .order('criado_em', { ascending: false });

  if (error) {
    logger.error({ err: error }, 'Error listing products');
    throw error;
  }

  return data || [];
}

export async function listAllProducts(options?: { limit?: number; offset?: number }): Promise<Product[]> {
  let query = supabaseAdmin
    .from('products')
    .select('*')
    .order('criado_em', { ascending: false });

  if (options?.limit !== undefined) {
    const from = options.offset ?? 0;
    query = query.range(from, from + options.limit - 1);
  }

  const { data, error } = await query;

  if (error) {
    logger.error({ err: error }, 'Error listing all products');
    throw error;
  }

  return data || [];
}

export async function createProduct(input: Record<string, unknown>): Promise<Product> {
  const { data, error } = await supabaseAdmin
    .from('products')
    .insert(input)
    .select()
    .single();

  if (error) {
    logger.error({ err: error }, 'Error creating product');
    throw error;
  }

  return data;
}

export async function createProductWithContentKit(
  product: Record<string, unknown>,
  contentKit: Record<string, unknown>,
  createdBy: string,
): Promise<{ product: Product; content_kit: Record<string, unknown> }> {
  const { data, error } = await supabaseAdmin.rpc('create_product_with_content_kit', {
    p_product: product,
    p_content_kit: contentKit,
    p_created_by: createdBy,
  });

  if (error) {
    logger.error({ err: error }, 'Error creating product with content kit');
    throw error;
  }

  return data as { product: Product; content_kit: Record<string, unknown> };
}

export async function updateProduct(id: string, input: Record<string, unknown>): Promise<Product> {
  const { data, error } = await supabaseAdmin
    .from('products')
    .update(input)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    logger.error({ err: error }, 'Error updating product');
    throw error;
  }

  return data;
}
