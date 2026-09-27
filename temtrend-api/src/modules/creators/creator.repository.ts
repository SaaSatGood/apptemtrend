import { supabaseAdmin } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';
import type { Creator } from '../../types/index.js';

export async function findCreatorByUserId(userId: string): Promise<Creator | null> {
  const { data, error } = await supabaseAdmin
    .from('creators')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    logger.error({ err: error }, 'Error finding creator by user_id');
    throw error;
  }

  return data;
}

export async function createCreator(input: {
  user_id: string;
  nicho: string[];
  plataformas: string[];
  objetivo: string;
  estilos_conteudo: string[];
  temas_interesse: string[];
  onboarding_completo: boolean;
}): Promise<Creator> {
  const { data, error } = await supabaseAdmin
    .from('creators')
    .insert({
      user_id: input.user_id,
      nicho: input.nicho,
      plataformas: input.plataformas,
      objetivo: input.objetivo,
      estilos_conteudo: input.estilos_conteudo,
      temas_interesse: input.temas_interesse,
      onboarding_completo: input.onboarding_completo,
      status: 'ativo',
    })
    .select()
    .single();

  if (error) {
    logger.error({ err: error }, 'Error creating creator');
    throw error;
  }

  return data;
}

export async function updateCreator(id: string, data: Partial<Creator>): Promise<Creator> {
  const { data: updated, error } = await supabaseAdmin
    .from('creators')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    logger.error({ err: error }, 'Error updating creator');
    throw error;
  }

  return updated;
}

export async function listCreators(filters?: { status?: string; nicho?: string }): Promise<Creator[]> {
  let query = supabaseAdmin.from('creators').select('*');

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.nicho) {
    query = query.contains('nicho', [filters.nicho]);
  }

  const { data, error } = await query.order('criado_em', { ascending: false });

  if (error) {
    logger.error({ err: error }, 'Error listing creators');
    throw error;
  }

  return data || [];
}

export async function countCreators(): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('creators')
    .select('*', { count: 'exact', head: true });

  if (error) {
    logger.error({ err: error }, 'Error counting creators');
    return 0;
  }

  return count || 0;
}

export async function countActiveCreators(): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('creators')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'ativo');

  if (error) {
    logger.error({ err: error }, 'Error counting active creators');
    return 0;
  }

  return count || 0;
}
