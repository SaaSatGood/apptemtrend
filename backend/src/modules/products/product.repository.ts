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

export async function findProductByExternalId(externalId: string): Promise<Product | null> {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('*')
    .eq('produto_externo_id', externalId)
    .maybeSingle();

  if (error) {
    logger.error({ err: error }, 'Error finding product by external ID');
    throw error;
  }

  return data;
}

export type ProductSort = 'relevancia' | 'vendas' | 'comissao' | 'preco' | 'recentes';

export interface ProductListFilters {
  categoria?: string;
  destaque?: boolean;
  limit?: number;
  offset?: number;
  onlySearchable?: boolean;
  q?: string;
  sort?: ProductSort;
  precoMax?: number;
  comissaoMin?: number;
}

// Select enxuto: cobre listagem pública, descoberta e IA (rank/motivos).
// Detalhe do produto e geração usam findProductById (linha completa).
const LIST_COLUMNS = [
  'id', 'produto_externo_id', 'nome', 'descricao', 'categoria',
  'imagem_url', 'loja_nome', 'preco_texto', 'preco_min_brl', 'preco_max_brl',
  'comissao_percentual', 'unidades_vendidas_total', 'unidades_vendidas_periodo',
  'tiktok_shop_url', 'status', 'destaque', 'ordem_destaque', 'criado_em',
].join(',');

/**
 * Vírgula, parênteses e curingas quebram (ou ampliam) a sintaxe do filtro
 * `or` do PostgREST; a busca é textual, então normalizamos para espaço.
 */
function sanitizeSearchTerm(value: string): string {
  return value.replace(/[%*,()"\\]/g, ' ').replace(/\s+/g, ' ').trim();
}

function catalogQuery(filters: ProductListFilters | undefined, withCount: boolean) {
  let query = supabaseAdmin
    .from('products')
    .select(LIST_COLUMNS, withCount ? { count: 'exact' } : undefined)
    .eq('status', PRODUCT_STATUS.ATIVO);

  if (filters?.categoria) {
    query = query.eq('categoria', filters.categoria);
  }

  if (filters?.destaque !== undefined) {
    query = query.eq('destaque', filters.destaque);
  }

  if (filters?.q) {
    const term = sanitizeSearchTerm(filters.q);
    if (term) {
      query = query.or(
        `nome.ilike.%${term}%,categoria.ilike.%${term}%,loja_nome.ilike.%${term}%`,
      );
    }
  }

  if (filters?.precoMax !== undefined) {
    query = query.lte('preco_min_brl', filters.precoMax);
  }

  if (filters?.comissaoMin !== undefined) {
    query = query.gte('comissao_percentual', filters.comissaoMin);
  }

  // Itens legados sem imagem não entram em recomendação.
  if (filters?.onlySearchable) {
    query = query.not('imagem_url', 'is', null).neq('imagem_url', '');
  }

  return query;
}

function orderCatalog(query: ReturnType<typeof catalogQuery>, sort: ProductSort | undefined) {
  switch (sort) {
    case 'vendas':
      return query
        .order('unidades_vendidas_total', { ascending: false, nullsFirst: false })
        .order('criado_em', { ascending: false });
    case 'comissao':
      return query
        .order('comissao_percentual', { ascending: false, nullsFirst: false })
        .order('criado_em', { ascending: false });
    case 'preco':
      return query
        .order('preco_min_brl', { ascending: true, nullsFirst: false })
        .order('criado_em', { ascending: false });
    case 'recentes':
      return query.order('criado_em', { ascending: false });
    default:
      return query
        .order('ordem_destaque', { ascending: false })
        .order('criado_em', { ascending: false });
  }
}

export async function listActiveProducts(filters?: ProductListFilters): Promise<Product[]> {
  let query = catalogQuery(filters, false);

  if (filters?.limit !== undefined) {
    const from = filters.offset ?? 0;
    query = query.range(from, from + filters.limit - 1);
  }

  const { data, error } = await orderCatalog(query, filters?.sort);

  if (error) {
    logger.error({ err: error }, 'Error listing products');
    throw error;
  }

  // Linhas parciais por desenho (LIST_COLUMNS enxuto); o restante do código
  // só toca nos campos selecionados.
  return (data || []) as unknown as Product[];
}

/**
 * Vitrine paginada com filtros: devolve a página e o total que casa com os
 * filtros, para a UI montar "carregar mais" sem varrer o catálogo inteiro.
 */
export async function searchActiveProducts(
  filters: ProductListFilters & { limit: number; offset: number },
): Promise<{ items: Product[]; total: number }> {
  const query = catalogQuery(filters, true).range(filters.offset, filters.offset + filters.limit - 1);
  const { data, error, count } = await orderCatalog(query, filters.sort);

  if (error) {
    // PGRST103 = página além do fim (corrida entre "carregar mais" e filtros).
    // Devolver vazio mantém a lista atual em vez de derrubar a tela.
    if (error.code === 'PGRST103') {
      return { items: [], total: filters.offset };
    }
    logger.error({ err: error }, 'Error searching products');
    throw error;
  }

  return {
    items: (data || []) as unknown as Product[],
    total: count ?? (data || []).length,
  };
}

/** Categorias do catálogo ativo com a quantidade de produtos de cada uma. */
export async function listActiveProductCategories(): Promise<Array<{ categoria: string; total: number }>> {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('categoria')
    .eq('status', PRODUCT_STATUS.ATIVO)
    .not('categoria', 'is', null)
    .neq('categoria', '');

  if (error) {
    logger.error({ err: error }, 'Error listing product categories');
    throw error;
  }

  const counts = new Map<string, number>();
  for (const row of (data || []) as Array<{ categoria?: string | null }>) {
    const categoria = (row.categoria ?? '').trim();
    if (!categoria) continue;
    counts.set(categoria, (counts.get(categoria) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([categoria, total]) => ({ categoria, total }))
    .sort((a, b) => a.categoria.localeCompare(b.categoria, 'pt-BR'));
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
