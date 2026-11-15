import { supabaseAdmin } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';
import { createAppError } from '../../types/index.js';

export interface BrandLeadInput {
  nome: string;
  email: string;
  telefone: string;
  mensagem: string;
}

// Reenvio do mesmo e-mail em 24h não duplica o lead (o envio é idempotente
// para quem apertou duas vezes), mas também não bloqueia um novo contato
// legítimo depois desse prazo.
const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function createBrandLead(
  input: BrandLeadInput,
  userId: string | null,
): Promise<{ duplicate: boolean }> {
  const since = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();

  const { data: existing, error: lookupError } = await supabaseAdmin
    .from('brand_leads')
    .select('id')
    .eq('email', input.email)
    .gte('created_at', since)
    .limit(1);

  if (lookupError) {
    // Deduplicação é otimização: se a consulta falhar, ainda tentamos gravar.
    logger.warn({ err: lookupError }, 'Brand lead duplicate check failed');
  } else if (existing && existing.length > 0) {
    return { duplicate: true };
  }

  const { error } = await supabaseAdmin.from('brand_leads').insert({
    nome: input.nome,
    email: input.email,
    telefone: input.telefone,
    mensagem: input.mensagem,
    user_id: userId,
    source: 'landing_marcas',
    status: 'novo',
  });

  if (error) {
    logger.error({ err: error }, 'Failed to create brand lead');
    throw createAppError(
      'BRAND_LEAD_FAILED',
      'Não conseguimos registrar seu cadastro agora. Tente novamente em instantes.',
      503,
    );
  }

  logger.info('Brand lead created');
  return { duplicate: false };
}
