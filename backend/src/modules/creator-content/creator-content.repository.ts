import { supabaseAdmin } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';
import type { ContentKit, CreatorContent, Product } from '../../types/index.js';

export interface CreatorContentWithRelations extends CreatorContent {
  products: Product | null;
  content_kits: ContentKit | null;
}

// Compatibilidade com bancos ainda sem a migration 034. A marca fica ao fim
// de notas, é removida das respostas da API e migra para a coluna dedicada.
const SCHEDULE_MARKER = /\n?\[temtrend:scheduled_for=(\d{4}-\d{2}-\d{2})\]$/;

function scheduledFromNotes(notes: string | null | undefined): string | null {
  return notes?.match(SCHEDULE_MARKER)?.[1] ?? null;
}

function cleanNotes(notes: string | null | undefined): string | null {
  return notes?.replace(SCHEDULE_MARKER, '') || null;
}

function withScheduleNotes(notes: string | null | undefined, schedule: string | null): string | null {
  const clean = cleanNotes(notes);
  return schedule ? `${clean ? `${clean}\n` : ''}[temtrend:scheduled_for=${schedule}]` : clean;
}

function presentContent<T extends CreatorContent>(content: T | null): T | null {
  if (!content) return null;
  return {
    ...content,
    notas: cleanNotes(content.notas),
    scheduled_for: content.scheduled_for ?? scheduledFromNotes(content.notas),
  };
}

export async function findCreatorContentById(id: string): Promise<CreatorContent | null> {
  const { data, error } = await supabaseAdmin
    .from('creator_content')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') {
    logger.error({ err: error }, 'Error finding creator content');
    throw error;
  }

  return presentContent(data);
}

export async function findCreatorContentWithRelationsById(id: string): Promise<CreatorContentWithRelations | null> {
  const { data, error } = await supabaseAdmin
    .from('creator_content')
    .select('*, products(*), content_kits(*)')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    logger.error({ err: error }, 'Error finding creator content with relations');
    throw error;
  }

  return presentContent(data);
}

export async function listCreatorContent(
  creatorId: string,
  options?: { limit?: number; offset?: number },
): Promise<CreatorContentWithRelations[]> {
  // Relações enxutas: a lista só mostra nome/imagem do produto e título/hook do kit.
  // Detalhe e roteiro completo vêm de endpoints próprios.
  const RELATIONS = '*, products(id,nome,imagem_url), content_kits(id,titulo,hook)';
  let query = supabaseAdmin
    .from('creator_content')
    .select(RELATIONS)
    .eq('creator_id', creatorId)
    .order('criado_em', { ascending: false });

  if (options?.limit !== undefined) {
    const from = options.offset ?? 0;
    query = query.range(from, from + options.limit - 1);
  }

  const { data, error } = await query;

  if (error) {
    logger.error({ err: error }, 'Error listing creator content');
    throw error;
  }

  return (data || []).map((item) => presentContent(item)!);
}

export async function findByCreatorAndKit(creatorId: string, contentKitId: string): Promise<CreatorContent | null> {
  const { data, error } = await supabaseAdmin
    .from('creator_content')
    .select('*')
    .eq('creator_id', creatorId)
    .eq('content_kit_id', contentKitId)
    .maybeSingle();

  if (error) {
    logger.error({ err: error }, 'Error checking duplicate creator content');
    throw error;
  }

  return presentContent(data);
}

export async function findByCreatorAndProduct(creatorId: string, productId: string): Promise<CreatorContent | null> {
  const { data, error } = await supabaseAdmin
    .from('creator_content')
    .select('*')
    .eq('creator_id', creatorId)
    .eq('product_id', productId)
    .is('content_kit_id', null)
    .maybeSingle();

  if (error) {
    logger.error({ err: error }, 'Error checking saved product');
    throw error;
  }

  return presentContent(data);
}

export async function findAnyByCreatorAndProduct(creatorId: string, productId: string): Promise<CreatorContent | null> {
  const { data, error } = await supabaseAdmin
    .from('creator_content')
    .select('*')
    .eq('creator_id', creatorId)
    .eq('product_id', productId)
    .order('atualizado_em', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.error({ err: error }, 'Error checking product production');
    throw error;
  }

  return presentContent(data);
}

export async function createCreatorContent(input: {
  creator_id: string;
  product_id?: string;
  content_kit_id?: string;
  status: string;
}): Promise<CreatorContent> {
  const { data, error } = await supabaseAdmin
    .from('creator_content')
    .insert(input)
    .select()
    .single();

  if (error) {
    logger.error({ err: error }, 'Error creating creator content');
    throw error;
  }

  return presentContent(data)!;
}

export async function deleteCreatorContent(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('creator_content')
    .delete()
    .eq('id', id);

  if (error) {
    logger.error({ err: error }, 'Error deleting creator content');
    throw error;
  }
}

export async function updateCreatorContent(id: string, input: Record<string, unknown>): Promise<CreatorContent> {
  const changes = { ...input };
  let existingNotes: string | null = null;
  if ('scheduled_for' in changes || 'notas' in changes) {
    const { data: existing, error: readError } = await supabaseAdmin
      .from('creator_content').select('notas, scheduled_for').eq('id', id).maybeSingle();
    if (readError?.code === '42703' || readError?.code === 'PGRST204') {
      const fallback = await supabaseAdmin.from('creator_content').select('notas').eq('id', id).maybeSingle();
      if (fallback.error) throw fallback.error;
      existingNotes = fallback.data?.notas ?? null;
    } else if (readError) {
      throw readError;
    } else {
      existingNotes = existing?.notas ?? null;
    }
    if ('notas' in changes && !('scheduled_for' in changes)) {
      const date = scheduledFromNotes(existingNotes);
      if (date) changes.notas = withScheduleNotes(changes.notas as string | null, date);
    }
    if ('scheduled_for' in changes && scheduledFromNotes(existingNotes)) {
      changes.notas = cleanNotes('notas' in changes ? changes.notas as string | null : existingNotes);
    }
  }
  const { data, error } = await supabaseAdmin
    .from('creator_content')
    .update(changes)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if ('scheduled_for' in input && (error.code === '42703' || error.code === 'PGRST204')) {
      const { scheduled_for: schedule, ...withoutColumn } = input;
      const notes = withScheduleNotes(
        'notas' in withoutColumn ? withoutColumn.notas as string | null : existingNotes,
        schedule as string | null,
      );
      const fallback = await supabaseAdmin.from('creator_content')
        .update({ ...withoutColumn, notas: notes }).eq('id', id).select().single();
      if (fallback.error) {
        logger.error({ err: fallback.error }, 'Error updating creator content schedule fallback');
        throw fallback.error;
      }
      return presentContent(fallback.data)!;
    }
    logger.error({ err: error }, 'Error updating creator content');
    throw error;
  }

  return presentContent(data)!;
}
