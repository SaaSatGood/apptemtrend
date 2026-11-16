import { supabaseAdmin } from '../../lib/supabase.js';
import { TtlCache } from '../../lib/cache.js';
import { getAiMetrics } from '../../lib/ai-metrics.js';
import { CACHE_TTL_MS } from '../../config/constants.js';
import { logger } from '../../lib/logger.js';

const dashboardCache = new TtlCache<Record<string, number | string>>(1);
const directoryCache = new TtlCache<Map<string, AuthUserSummary>>(1);
const categoriesCache = new TtlCache<string[]>(1);
const DASHBOARD_KEY = 'dashboard';
const DIRECTORY_KEY = 'directory';
const CATEGORIES_KEY = 'categories';

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
  const extras = await Promise.all([
    countRows('brand_leads', [['status', 'novo']]),
    countRows('products', [['destaque', true]]),
    countRows('support_tickets', [['status', 'answered']]),
    countRows('creators', [['plan_status', 'trialing']]),
    countRows('brand_leads', []),
    countRows('brand_leads', [['status', 'qualificado']]),
  ]);
  Object.assign(values, {
    leads_novos: extras[0],
    produtos_destaque: extras[1],
    suporte_respondidos: extras[2],
    creators_trial: extras[3],
    total_leads: extras[4],
    leads_qualificados: extras[5],
  });
  dashboardCache.set(DASHBOARD_KEY, values, CACHE_TTL_MS.DASHBOARD);
  return values;
}

async function countRows(
  table: string,
  filters: Array<[string, string | number | boolean]>,
): Promise<number> {
  let query = supabaseAdmin.from(table).select('*', { count: 'exact', head: true });
  for (const [column, value] of filters) query = query.eq(column, value);
  const { count, error } = await query;
  if (error) {
    logger.error({ err: error, table }, 'Error loading dashboard counter');
    return 0;
  }
  return count ?? 0;
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

// ---- Catálogo: paginação e filtros no servidor ----
// O catálogo tem milhares de itens: carregar tudo no browser travava o painel.
export interface AdminProductQuery {
  q?: string;
  status?: string;
  categoria?: string;
  sort?: 'ranking' | 'vendas' | 'receita' | 'nome';
  page: number;
  limit: number;
}

export interface AdminProductRow {
  id: string;
  produto_externo_id: string | null;
  nome: string;
  categoria: string | null;
  imagem_url: string | null;
  preco_texto: string | null;
  preco_min_brl: number | null;
  preco_max_brl: number | null;
  loja_nome: string | null;
  comissao_percentual: number | null;
  unidades_vendidas_periodo: number | null;
  crescimento_vendas_percentual: number | null;
  receita_periodo_brl: number | null;
  tiktok_shop_url: string | null;
  ranking_origem: number | null;
  destaque: boolean | null;
  ordem_destaque: number | null;
  status: string;
}

// `.or()` do PostgREST usa vírgula/parênteses como sintaxe: limpar a busca
// evita filtro quebrado (e não abre espaço para injeção de expressão).
function sanitizeSearch(value: string): string {
  return value.replace(/[,()%\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}

function productsQuery(query: AdminProductQuery) {
  let request = supabaseAdmin
    .from('products')
    .select(
      'id, produto_externo_id, nome, categoria, imagem_url, preco_texto, preco_min_brl, preco_max_brl, loja_nome, comissao_percentual, unidades_vendidas_periodo, crescimento_vendas_percentual, receita_periodo_brl, tiktok_shop_url, ranking_origem, destaque, ordem_destaque, status',
      { count: 'exact' },
    );

  if (query.status) request = request.eq('status', query.status);
  if (query.categoria) request = request.eq('categoria', query.categoria);

  const term = query.q ? sanitizeSearch(query.q) : '';
  if (term) {
    request = request.or(
      `nome.ilike.%${term}%,loja_nome.ilike.%${term}%,categoria.ilike.%${term}%,produto_externo_id.ilike.%${term}%`,
    );
  }

  switch (query.sort) {
    case 'vendas':
      return request.order('unidades_vendidas_periodo', { ascending: false, nullsFirst: false });
    case 'receita':
      return request.order('receita_periodo_brl', { ascending: false, nullsFirst: false });
    case 'nome':
      return request.order('nome', { ascending: true });
    default:
      return request.order('ranking_origem', { ascending: true, nullsFirst: false });
  }
}

export async function listProductsPage(query: AdminProductQuery): Promise<{
  items: AdminProductRow[];
  total: number;
  page: number;
  limit: number;
}> {
  const from = (query.page - 1) * query.limit;
  const { data, error, count } = await productsQuery(query).range(from, from + query.limit - 1);
  if (error) {
    logger.error({ err: error }, 'Error listing admin products');
    throw error;
  }
  return {
    items: (data ?? []) as AdminProductRow[],
    total: count ?? 0,
    page: query.page,
    limit: query.limit,
  };
}

/** Exportação CSV respeita os mesmos filtros da listagem, sem paginar a tela. */
export async function listProductsForExport(query: AdminProductQuery, maxRows = 20000) {
  const pageSize = 1000;
  const rows: AdminProductRow[] = [];
  for (let from = 0; from < maxRows; from += pageSize) {
    const { data, error } = await productsQuery({ ...query, page: 1, limit: pageSize })
      .range(from, from + pageSize - 1);
    if (error) {
      logger.error({ err: error }, 'Error exporting admin products');
      throw error;
    }
    const batch = (data ?? []) as AdminProductRow[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

export async function listProductCategories(): Promise<string[]> {
  const cached = categoriesCache.get(CATEGORIES_KEY);
  if (cached) return cached;

  const found = new Set<string>();
  const pageSize = 1000;
  for (let from = 0; from < 20000; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from('products')
      .select('categoria')
      .not('categoria', 'is', null)
      .order('categoria', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) {
      logger.error({ err: error }, 'Error listing product categories');
      throw error;
    }
    const batch = (data ?? []) as Array<{ categoria: string | null }>;
    for (const row of batch) if (row.categoria) found.add(row.categoria);
    if (batch.length < pageSize) break;
  }

  const categories = [...found].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  categoriesCache.set(CATEGORIES_KEY, categories, CACHE_TTL_MS.CATALOG);
  return categories;
}

export function invalidateProductCategoriesCache() {
  categoriesCache.delete(CATEGORIES_KEY);
}

// ---- Leads de marca (landing de marcas) ----
export const LEAD_STATUSES = ['novo', 'contatado', 'qualificado', 'descartado'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export interface AdminLeadRow {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  mensagem: string;
  status: string;
  source: string | null;
  created_at: string;
  updated_at: string | null;
}

export async function listLeadsPage(query: {
  status?: string;
  q?: string;
  page: number;
  limit: number;
}): Promise<{ items: AdminLeadRow[]; total: number; page: number; limit: number }> {
  const from = (query.page - 1) * query.limit;
  let request = supabaseAdmin
    .from('brand_leads')
    .select('id, nome, email, telefone, mensagem, status, source, created_at, updated_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + query.limit - 1);

  if (query.status) request = request.eq('status', query.status);
  const term = query.q ? sanitizeSearch(query.q) : '';
  if (term) request = request.or(`nome.ilike.%${term}%,email.ilike.%${term}%,telefone.ilike.%${term}%`);

  const { data, error, count } = await request;
  if (error) {
    logger.error({ err: error }, 'Error listing brand leads');
    throw error;
  }
  return {
    items: (data ?? []) as AdminLeadRow[],
    total: count ?? 0,
    page: query.page,
    limit: query.limit,
  };
}

export async function updateLeadStatus(id: string, status: LeadStatus) {
  const { data, error } = await supabaseAdmin
    .from('brand_leads')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, status, updated_at')
    .maybeSingle();
  if (error) {
    logger.error({ err: error }, 'Error updating brand lead status');
    throw error;
  }
  invalidateDashboardCache();
  return data;
}

// ---- Uso de IA persistido (série dos últimos dias) ----
export async function aiUsageSeries(days: number) {
  const since = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data, error } = await supabaseAdmin
    .from('ai_metrics_daily')
    .select('usage_date, classify_calls, classify_tokens, classify_cache_hits, generate_calls, generate_tokens, generate_retries')
    .gte('usage_date', since)
    .order('usage_date', { ascending: true });
  if (error) {
    logger.error({ err: error }, 'Error loading AI usage series');
    return [];
  }
  return data ?? [];
}

export interface AiDailyUsage {
  usage_date: string;
  assistant_calls: number;
  kit_calls: number;
  support_calls: number;
  total_tokens: number;
}

/**
 * Consumo real por dia somando `ai_usage_daily` (uma linha por usuário/dia).
 * É a fonte mais confiável: as cotas sempre gravam ali, enquanto
 * `ai_metrics_daily` depende do RPC de métricas.
 */
export async function aiUsageDailySeries(days: number): Promise<AiDailyUsage[]> {
  const since = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data, error } = await supabaseAdmin
    .from('ai_usage_daily')
    .select('usage_date, assistant_calls, kit_calls, support_calls, total_tokens')
    .gte('usage_date', since)
    .order('usage_date', { ascending: true })
    .limit(5000);
  if (error) {
    logger.error({ err: error }, 'Error loading per-user AI usage');
    return [];
  }
  const byDay = new Map<string, AiDailyUsage>();
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const day = String(row.usage_date);
    const entry = byDay.get(day) ?? {
      usage_date: day,
      assistant_calls: 0,
      kit_calls: 0,
      support_calls: 0,
      total_tokens: 0,
    };
    entry.assistant_calls += Number(row.assistant_calls ?? 0);
    entry.kit_calls += Number(row.kit_calls ?? 0);
    entry.support_calls += Number(row.support_calls ?? 0);
    entry.total_tokens += Number(row.total_tokens ?? 0);
    byDay.set(day, entry);
  }
  return [...byDay.values()].sort((a, b) => a.usage_date.localeCompare(b.usage_date));
}

// ---- Detalhe do creator (plano, uso de IA e histórico) ----
export async function creatorDetail(creatorId: string) {
  const { data: creator, error } = await supabaseAdmin
    .from('creators')
    .select('*')
    .eq('id', creatorId)
    .maybeSingle();
  if (error) {
    logger.error({ err: error }, 'Error loading creator detail');
    throw error;
  }
  if (!creator) return null;

  const since = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [subscriptions, usage, kits, sessions, tickets, contents, shares] = await Promise.all([
    supabaseAdmin
      .from('subscriptions')
      .select('id, plan, period, status, amount_cents, current_period_end, pending_plan, created_at')
      .eq('creator_id', creatorId)
      .order('created_at', { ascending: false })
      .limit(5),
    supabaseAdmin
      .from('ai_usage_daily')
      .select('usage_date, assistant_calls, kit_calls, support_calls, total_tokens')
      .eq('user_id', creator.user_id)
      .gte('usage_date', since)
      .order('usage_date', { ascending: false }),
    supabaseAdmin.from('content_kits').select('*', { count: 'exact', head: true }).eq('creator_id', creatorId),
    supabaseAdmin
      .from('discovery_sessions')
      .select('id, title, created_at, updated_at', { count: 'exact' })
      .eq('creator_id', creatorId)
      .order('updated_at', { ascending: false })
      .limit(5),
    supabaseAdmin
      .from('support_tickets')
      .select('id, subject, status, category, last_message_at', { count: 'exact' })
      .eq('creator_id', creatorId)
      .order('last_message_at', { ascending: false })
      .limit(5),
    supabaseAdmin.from('creator_content').select('*', { count: 'exact', head: true }).eq('creator_id', creatorId),
    supabaseAdmin.from('shared_conversations').select('*', { count: 'exact', head: true }).eq('creator_id', creatorId),
  ]);

  return {
    creator,
    subscriptions: subscriptions.data ?? [],
    usage: usage.data ?? [],
    sessions: sessions.data ?? [],
    tickets: tickets.data ?? [],
    counts: {
      content_kits: kits.count ?? 0,
      discovery_sessions: sessions.count ?? 0,
      support_tickets: tickets.count ?? 0,
      creator_content: contents.count ?? 0,
      shared_conversations: shares.count ?? 0,
    },
  };
}

