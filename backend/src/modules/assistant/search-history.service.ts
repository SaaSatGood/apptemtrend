import { supabaseAdmin } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';
import { Errors, type Product } from '../../types/index.js';

/**
 * Histórico de buscas do Descobrir. Cada busca guarda o texto, a mensagem da IA
 * e o retrato dos produtos exibidos, então reabrir uma busca antiga não gasta
 * cota diária nem faz nova chamada de IA.
 */

export const MAX_SAVED_SEARCHES = 30;

interface SearchRow {
  id: string;
  query: string;
  message: string | null;
  results: unknown;
  context_ids: unknown;
  needs_clarification: boolean | null;
  result_count: number | null;
  created_at: string;
  updated_at: string;
}

export interface SearchSummary {
  id: string;
  query: string;
  result_count: number;
  needs_clarification: boolean;
  created_at: string;
  updated_at: string;
}

export interface SavedSearch extends SearchSummary {
  message: string;
  results: Product[];
  context_ids: string[];
}

/** Chave de deduplicação: mesma frase, sem acento/caixa/espaços extras. */
export function searchQueryKey(query: string): string {
  return query
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

function summaryOf(row: Pick<SearchRow, 'id' | 'query' | 'result_count' | 'needs_clarification' | 'created_at' | 'updated_at'>): SearchSummary {
  return {
    id: row.id,
    query: row.query,
    result_count: row.result_count ?? 0,
    needs_clarification: Boolean(row.needs_clarification),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function arrayOf<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export async function listSearches(creatorId: string, limit = MAX_SAVED_SEARCHES): Promise<SearchSummary[]> {
  const { data, error } = await supabaseAdmin
    .from('discovery_searches')
    .select('id, query, result_count, needs_clarification, created_at, updated_at')
    .eq('creator_id', creatorId)
    .order('updated_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), MAX_SAVED_SEARCHES));
  if (error) throw error;
  return (data ?? []).map((row) => summaryOf(row as SearchRow));
}

export async function getSearch(creatorId: string, id: string): Promise<SavedSearch> {
  const { data, error } = await supabaseAdmin
    .from('discovery_searches')
    .select('id, query, message, results, context_ids, needs_clarification, result_count, created_at, updated_at')
    .eq('id', id)
    .eq('creator_id', creatorId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw Errors.NOT_FOUND('Busca');
  const row = data as SearchRow;
  return {
    ...summaryOf(row),
    message: row.message ?? '',
    results: arrayOf<Product>(row.results),
    context_ids: arrayOf<string>(row.context_ids),
  };
}

/** Produto no formato público devolvido pela busca (subconjunto do catálogo). */
export type SearchSnapshotProduct = { id: string } & Record<string, unknown>;

export interface SaveSearchInput {
  creatorId: string;
  userId: string;
  query: string;
  message?: string | null;
  products?: SearchSnapshotProduct[] | null;
  needsClarification?: boolean;
}

/**
 * Salva (ou atualiza) a busca do creator. Falhas de persistência não derrubam
 * a busca em si: o resultado já foi entregue ao usuário.
 */
export async function saveSearch(input: SaveSearchInput): Promise<{ id: string } | null> {
  const query = input.query.trim().replace(/\s+/g, ' ').slice(0, 500);
  const queryKey = searchQueryKey(query);
  if (!queryKey) return null;

  try {
    const products = Array.isArray(input.products) ? input.products.slice(0, 10) : [];
    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from('discovery_searches')
      .upsert({
        creator_id: input.creatorId,
        user_id: input.userId,
        query,
        query_key: queryKey,
        message: (input.message ?? '').slice(0, 2000),
        results: products,
        context_ids: products.map((product) => product.id),
        needs_clarification: Boolean(input.needsClarification),
        result_count: products.length,
        updated_at: now,
      }, { onConflict: 'creator_id,query_key' })
      .select('id')
      .maybeSingle();

    if (error) {
      logger.warn({ err: error }, 'Failed to save discovery search history');
      return null;
    }

    await pruneSearches(input.creatorId);
    return (data as { id: string } | null) ?? null;
  } catch (err) {
    logger.warn({ err }, 'Failed to save discovery search history');
    return null;
  }
}

/** Mantém só as buscas mais recentes por creator. */
async function pruneSearches(creatorId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('discovery_searches')
    .select('id')
    .eq('creator_id', creatorId)
    .order('updated_at', { ascending: false })
    .range(MAX_SAVED_SEARCHES, MAX_SAVED_SEARCHES + 49);
  if (error || !data?.length) return;

  const ids = (data as Array<{ id: string }>).map((row) => row.id);
  const { error: deleteError } = await supabaseAdmin
    .from('discovery_searches')
    .delete()
    .eq('creator_id', creatorId)
    .in('id', ids);
  if (deleteError) logger.warn({ err: deleteError }, 'Failed to prune discovery search history');
}

export async function deleteSearch(creatorId: string, id: string): Promise<{ id: string; deleted: boolean }> {
  const { error } = await supabaseAdmin
    .from('discovery_searches')
    .delete()
    .eq('id', id)
    .eq('creator_id', creatorId);
  if (error) throw error;
  return { id, deleted: true };
}

export async function clearSearches(creatorId: string): Promise<{ deleted: number }> {
  const { data, error } = await supabaseAdmin
    .from('discovery_searches')
    .delete()
    .eq('creator_id', creatorId)
    .select('id');
  if (error) throw error;
  return { deleted: Array.isArray(data) ? data.length : 0 };
}
