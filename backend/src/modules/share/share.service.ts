import { randomBytes } from 'node:crypto';
import type { z } from 'zod';
import { supabaseAdmin } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';
import { Errors, createAppError, type ContentKit, type Creator } from '../../types/index.js';
import { assertKitQuota } from '../billing/billing.gating.js';
import { createContentKit } from '../content-kits/content-kit.repository.js';
import type { SharedTurnInput } from './share.schema.js';

/**
 * Links compartilhaveis do Descobrir. Uma conversa vira um registro com o
 * retrato dos turnos (pergunta, resposta e produtos); quem abre o link -- sempre
 * logado -- escolhe ver como chatbot ou como roteiro e pode abrir a tela de
 * gravar conteudo com um clique (o roteiro do dono e copiado para o workspace
 * de quem recebeu, sem gastar IA).
 */

const MAX_SHARED_PER_CREATOR = 50;
const KIT_COLUMNS =
  'id, product_id, titulo, descricao, formato, plataforma, nivel_dificuldade, hook, roteiro, cenas, copy, cta, hashtags, audio_sugerido, duracao_seg, briefing_usuario, usou_voz, criado_em';
const PRODUCT_COLUMNS =
  'id, produto_externo_id, nome, descricao, categoria, imagem_url, loja_nome, preco_texto, preco_min_brl, preco_max_brl, comissao_percentual, unidades_vendidas_periodo, unidades_vendidas_total, tiktok_shop_url, atualizado_em';

export interface SharedProductSnapshot {
  id: string;
  nome: string;
  motivo?: string | null;
  [key: string]: unknown;
}

export interface SharedTurn {
  query: string;
  message: string;
  products: SharedProductSnapshot[];
  needs_clarification: boolean;
  image_name: string | null;
}

export interface SharedConversationSummary {
  slug: string;
  title: string;
  turn_count: number;
  product_count: number;
  criado_em: string;
}

export interface SharedConversation extends SharedConversationSummary {
  turns: Array<SharedTurn & { products: Array<SharedProductSnapshot & { content_kits?: ContentKit[] }> }>;
  is_owner: boolean;
}

interface SharedRow {
  id: string;
  slug: string;
  creator_id: string;
  user_id: string;
  title: string;
  turns: unknown;
  turn_count: number | null;
  product_count: number | null;
  revoked: boolean;
  criado_em: string;
}

/** Token curto, tipado em URL e dificil de adivinhar (~64 bits). */
function newSlug(): string {
  return randomBytes(9).toString('base64url');
}

export function shareUrlPath(slug: string): string {
  return `/compartilhar/${slug}`;
}

function arrayOf<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function summaryOf(row: SharedRow): SharedConversationSummary {
  return {
    slug: row.slug,
    title: row.title,
    turn_count: row.turn_count ?? 0,
    product_count: row.product_count ?? 0,
    criado_em: row.criado_em,
  };
}

function normalizeTurns(turns: SharedTurnInput[]): SharedTurn[] {
  return turns.map((turn) => ({
    query: turn.query.trim().replace(/\s+/g, ' ').slice(0, 500),
    message: turn.message,
    products: turn.products.map((product) => ({ ...product })),
    needs_clarification: Boolean(turn.needs_clarification),
    image_name: turn.image_name ?? null,
  }));
}

export async function createSharedConversation(input: {
  creatorId: string;
  userId: string;
  title?: string;
  turns: SharedTurnInput[];
}): Promise<SharedConversationSummary> {
  const turns = normalizeTurns(input.turns);
  const productIds = new Set(turns.flatMap((turn) => turn.products.map((product) => product.id)));
  const title = (input.title || turns[0].query).trim().replace(/\s+/g, ' ').slice(0, 120);

  const { data, error } = await supabaseAdmin
    .from('shared_conversations')
    .insert({
      slug: newSlug(),
      creator_id: input.creatorId,
      user_id: input.userId,
      title,
      turns,
      turn_count: turns.length,
      product_count: productIds.size,
    })
    .select('id, slug, title, turn_count, product_count, criado_em')
    .single();
  if (error) {
    logger.error({ err: error }, 'Failed to create shared conversation');
    throw error;
  }

  await pruneSharedConversations(input.creatorId);
  return data as SharedConversationSummary;
}

/** Mantem apenas os links mais recentes do creator. */
async function pruneSharedConversations(creatorId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('shared_conversations')
    .select('id')
    .eq('creator_id', creatorId)
    .order('criado_em', { ascending: false })
    .range(MAX_SHARED_PER_CREATOR, MAX_SHARED_PER_CREATOR + 49);
  if (error || !data?.length) return;
  const ids = (data as Array<{ id: string }>).map((row) => row.id);
  const { error: deleteError } = await supabaseAdmin
    .from('shared_conversations')
    .delete()
    .eq('creator_id', creatorId)
    .in('id', ids);
  if (deleteError) logger.warn({ err: deleteError }, 'Failed to prune shared conversations');
}

export async function listSharedConversations(creatorId: string): Promise<SharedConversationSummary[]> {
  const { data, error } = await supabaseAdmin
    .from('shared_conversations')
    .select('id, slug, title, turn_count, product_count, criado_em')
    .eq('creator_id', creatorId)
    .eq('revoked', false)
    .order('criado_em', { ascending: false })
    .limit(MAX_SHARED_PER_CREATOR);
  if (error) throw error;
  return (data ?? []).map((row) => summaryOf(row as unknown as SharedRow));
}

async function findSharedRow(slug: string): Promise<SharedRow> {
  const { data, error } = await supabaseAdmin
    .from('shared_conversations')
    .select('id, slug, creator_id, user_id, title, turns, turn_count, product_count, revoked, criado_em')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  const row = data as SharedRow | null;
  // Link inexistente e link revogado respondem igual: o endereço nao expoe nada.
  if (!row || row.revoked) {
    throw createAppError('RESOURCE_NOT_FOUND', 'Este link nao esta mais disponivel.', 404);
  }
  return row;
}

/**
 * Conversa compartilhada com produtos re-hidratados do catalogo (o link nao
 * apodrece com preco antigo) e os roteiros do dono para a visao "roteiro".
 */
export async function getSharedConversation(slug: string, viewerCreatorId: string): Promise<SharedConversation> {
  const row = await findSharedRow(slug);
  const turns = arrayOf<SharedTurn>(row.turns);

  const productIds = [...new Set(turns.flatMap((turn) => turn.products.map((product) => product.id)))];
  const [catalogResult, kitsResult] = await Promise.all([
    productIds.length
      ? supabaseAdmin.from('products').select(PRODUCT_COLUMNS).in('id', productIds)
      : Promise.resolve({ data: [], error: null }),
    productIds.length
      ? supabaseAdmin.from('content_kits').select(KIT_COLUMNS).eq('creator_id', row.creator_id).in('product_id', productIds).order('criado_em', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (catalogResult.error) throw catalogResult.error;
  if (kitsResult.error) throw kitsResult.error;

  const catalog = new Map<string, Record<string, unknown>>(
    ((catalogResult.data ?? []) as Array<{ id: string }>).map((product) => [product.id, product as unknown as Record<string, unknown>]),
  );
  const kitsByProduct = new Map<string, ContentKit[]>();
  for (const kit of (kitsResult.data ?? []) as ContentKit[]) {
    const list = kitsByProduct.get(kit.product_id) ?? [];
    list.push(kit);
    kitsByProduct.set(kit.product_id, list);
  }

  return {
    ...summaryOf(row),
    is_owner: row.creator_id === viewerCreatorId,
    turns: turns.map((turn) => ({
      ...turn,
      products: turn.products.map((snapshot) => {
        // Snapshot salvo na criacao cobre produtos que sairam do catalogo.
        const fresh = catalog.get(snapshot.id);
        return {
          ...(fresh ?? snapshot),
          id: snapshot.id,
          nome: typeof fresh?.nome === 'string' ? fresh.nome : snapshot.nome,
          motivo: snapshot.motivo ?? null,
          content_kits: kitsByProduct.get(snapshot.id) ?? [],
        };
      }),
    })),
  };
}

/**
 * Copia o roteiro do dono para o workspace de quem recebeu o link e devolve o
 * kit pronto para a tela de gravar. Idempotente: o mesmo roteiro nunca e
 * copiado duas vezes para a mesma conta.
 */
export async function importSharedKit(input: {
  slug: string;
  viewer: Creator;
  productId: string;
  contentKitId?: string;
}): Promise<{ content_kit: ContentKit; created: boolean }> {
  const row = await findSharedRow(input.slug);

  // O dono ja tem o roteiro: abre direto, sem copia.
  if (row.creator_id === input.viewer.id) {
    const own = await findSourceKit(row.creator_id, input.productId, input.contentKitId);
    return { content_kit: own, created: false };
  }

  const source = await findSourceKit(row.creator_id, input.productId, input.contentKitId);

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('content_kits')
    .select('id')
    .eq('creator_id', input.viewer.id)
    .eq('source_kit_id', source.id)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) {
    const reused = await findKitById(existing.id as string);
    return { content_kit: reused, created: false };
  }

  // Copia nao gasta IA, mas vira um roteiro no plano de quem recebe.
  await assertKitQuota(input.viewer, input.productId);

  const copied = await createContentKit(
    input.productId,
    {
      titulo: source.titulo,
      descricao: source.descricao,
      formato: source.formato,
      plataforma: source.plataforma,
      nivel_dificuldade: source.nivel_dificuldade,
      hook: source.hook,
      roteiro: source.roteiro,
      cenas: source.cenas,
      copy: source.copy,
      cta: source.cta,
      hashtags: source.hashtags,
      audio_sugerido: source.audio_sugerido,
      duracao_seg: source.duracao_seg,
      source_kit_id: source.id,
    },
    { creatorId: input.viewer.id, briefing: source.briefing_usuario ?? undefined, usouVoz: false },
  );
  return { content_kit: copied, created: true };
}

async function findSourceKit(creatorId: string, productId: string, kitId?: string): Promise<ContentKit> {
  let query = supabaseAdmin
    .from('content_kits')
    .select(KIT_COLUMNS)
    .eq('creator_id', creatorId)
    .eq('product_id', productId);
  if (kitId) query = query.eq('id', kitId);
  const { data, error } = await query.order('criado_em', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  if (!data) {
    throw createAppError('RESOURCE_NOT_FOUND', 'Este link ainda nao tem roteiro para este produto.', 404);
  }
  return data as ContentKit;
}

async function findKitById(id: string): Promise<ContentKit> {
  const { data, error } = await supabaseAdmin
    .from('content_kits')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as ContentKit;
}

export async function revokeSharedConversation(creatorId: string, slug: string): Promise<{ slug: string; revoked: boolean }> {
  const { data, error } = await supabaseAdmin
    .from('shared_conversations')
    .update({ revoked: true, atualizado_em: new Date().toISOString() })
    .eq('slug', slug)
    .eq('creator_id', creatorId)
    .select('slug')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw Errors.NOT_FOUND('Link da conversa');
  return { slug: (data as { slug: string }).slug, revoked: true };
}
