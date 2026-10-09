import { z } from 'zod';
import { env } from '../../config/env.js';
import { supabaseAdmin } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';
import { createProductSchema } from './product.schema.js';

const feedProductSchema = createProductSchema.extend({
  produto_externo_id: z.string().trim().min(1).max(80),
});

const feedSchema = z.union([
  z.array(feedProductSchema).max(5000),
  z.object({ products: z.array(feedProductSchema).max(5000) }).strict().transform((value) => value.products),
]);

export async function syncConfiguredCatalog() {
  if (!env.CATALOG_FEED_URL) throw new Error('CATALOG_FEED_URL is not configured');
  const headers: Record<string, string> = { accept: 'application/json' };
  if (env.CATALOG_FEED_TOKEN) headers.authorization = `Bearer ${env.CATALOG_FEED_TOKEN}`;

  const response = await fetch(env.CATALOG_FEED_URL, {
    headers,
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Catalog feed returned HTTP ${response.status}`);

  const products = feedSchema.parse(await response.json());
  if (!products.length) return { received: 0, synchronized: 0 };

  const rows = products.map((product) => ({ ...product, fonte_dados: product.fonte_dados ?? 'catalog-feed' }));
  const { error } = await supabaseAdmin
    .from('products')
    .upsert(rows, { onConflict: 'produto_externo_id', ignoreDuplicates: false });
  if (error) throw error;

  logger.info({ received: products.length, synchronized: rows.length }, 'Catalog feed synchronized');
  return { received: products.length, synchronized: rows.length };
}
