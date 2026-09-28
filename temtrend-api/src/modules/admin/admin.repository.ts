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
    if (error) {
      logger.error({ err: error, table }, 'Error loading dashboard metric');
      throw error;
    }
    values[key] = count ?? 0;
  }));
  return values;
}

export interface AuthUserSummary {
  id: string;
  email: string | null;
  nome: string | null;
}

// One batched pass over the auth users instead of one lookup per creator (N+1).
export async function listUserDirectory(): Promise<Map<string, AuthUserSummary>> {
  const directory = new Map<string, AuthUserSummary>();
  const perPage = 1000;
  const maxPages = 50;
  let page = 1;

  while (page <= maxPages) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });

    if (error || !data) {
      logger.error({ err: error }, 'Error listing auth users');
      break;
    }

    for (const user of data.users) {
      const metadata = (user.user_metadata ?? {}) as { full_name?: string; name?: string };
      directory.set(user.id, {
        id: user.id,
        email: user.email ?? null,
        nome: metadata.full_name ?? metadata.name ?? null,
      });
    }

    if (data.users.length < perPage) break;
    if (typeof data.lastPage === 'number' && page >= data.lastPage) break;
    page += 1;
  }

  return directory;
}
