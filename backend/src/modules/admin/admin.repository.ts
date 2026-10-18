import { supabaseAdmin } from '../../lib/supabase.js';
import { TtlCache } from '../../lib/cache.js';
import { getAiMetrics } from '../../lib/ai-metrics.js';
import { CACHE_TTL_MS } from '../../config/constants.js';
import { logger } from '../../lib/logger.js';

const dashboardCache = new TtlCache<Record<string, number | string>>(1);
const directoryCache = new TtlCache<Map<string, AuthUserSummary>>(1);
const DASHBOARD_KEY = 'dashboard';
const DIRECTORY_KEY = 'directory';

export async function dashboard() {
  const cached = dashboardCache.get(DASHBOARD_KEY);
  if (cached) return cached;
  const tables = [
    ['total_creators', 'creators', undefined], ['creators_ativos', 'creators', 'ativo'],
    ['total_produtos', 'products', undefined], ['produtos_ativos', 'products', 'ativo'],
    ['produtos_pausados', 'products', 'pausado'], ['creators_bloqueados', 'creators', 'bloqueado'],
    ['total_content_kits', 'content_kits', undefined],
    ['oportunidades_salvas', 'creator_content', 'salvo'], ['conteudos_publicados', 'creator_content', 'publicado'],
    ['suporte_abertos', 'support_tickets', 'open'], ['assinaturas_ativas', 'subscriptions', 'active'],
  ] as const;
  const values: Record<string, number | string> = {};
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
  const ai = getAiMetrics();
  Object.assign(values, {
    ai_classify_calls: ai.classifyCalls,
    ai_classify_tokens: ai.classifyTokens,
    ai_classify_cache_hits: ai.classifyCacheHits,
    ai_generate_calls: ai.generateCalls,
    ai_generate_tokens: ai.generateTokens,
  });
  dashboardCache.set(DASHBOARD_KEY, values, CACHE_TTL_MS.DASHBOARD);
  return values;
}

export function invalidateDashboardCache() {
  dashboardCache.delete(DASHBOARD_KEY);
}

export interface AuthUserSummary {
  id: string;
  email: string | null;
  nome: string | null;
}

// One batched pass over the auth users instead of one lookup per creator (N+1).
// Resultado em cache 10min: evita varrer até 50 páginas a cada request admin.
export async function listUserDirectory(): Promise<Map<string, AuthUserSummary>> {
  const cached = directoryCache.get(DIRECTORY_KEY);
  if (cached) return cached;
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

  directoryCache.set(DIRECTORY_KEY, directory, CACHE_TTL_MS.USER_DIRECTORY);
  return directory;
}
