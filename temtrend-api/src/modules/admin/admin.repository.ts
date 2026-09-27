import { supabaseAdmin } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';

export async function dashboard() {
  const tables = [
    ['total_creators', 'creators', undefined], ['creators_ativos', 'creators', 'ativo'],
    ['produtos_ativos', 'products', 'ativo'], ['total_content_kits', 'content_kits', undefined],
    ['oportunidades_salvas', 'creator_content', 'salvo'], ['conteudos_publicados', 'creator_content', 'publicado'],
  ] as const;
  const values: Record<string, number> = {};
  await Promise.all(tables.map(async ([key, table, status]) => {
    let query = supabaseAdmin.from(table).select('*', { count: 'exact', head: true });
    if (status) query = query.eq('status', status);
    const { count, error } = await query;
    if (error) logger.error({ err: error, table }, 'Error loading dashboard metric');
    values[key] = count ?? 0;
  }));
  return values;
}
