import { supabaseAdmin } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';
import { Errors } from '../../types/index.js';

/**
 * Sessões do Descobrir: cada conversa do chatbot ganha um ID e uma URL fixa
 * (/descobrir/{id}) para o criador reabrir pelo histórico da sidebar.
 * A conversa inteira (turnos: pergunta, resposta e produtos) é guardada em
 * JSONB, então reabrir uma sessão não gasta cota nem faz nova chamada de IA.
 */

export const MAX_SESSION_TURNS = 12;
export const MAX_SESSIONS_PER_CREATOR = 30;
const MAX_TURN_PRODUCTS = 10;

export interface DiscoverySessionTurn {
  query: string;
  message: string;
  products: Array<Record<string, unknown>>;
  needs_clarification?: boolean;
  image_name?: string | null;
}

export interface DiscoverySessionSummary {
  id: string;
  title: string;
  context: string;
  turn_count: number;
  created_at: string;
  updated_at: string;
}

export interface DiscoverySession extends DiscoverySessionSummary {
  turns: DiscoverySessionTurn[];
}

interface SessionRow {
  id: string;
  title: string;
  context: string | null;
  turns: unknown;
  created_at: string;
  updated_at: string;
}

function titleOf(value: string | null | undefined): string {
  const raw = String(value ?? '').trim().replace(/\s+/g, ' ');
  return raw.slice(0, 120);
}

const PLACEHOLDER_TITLE = /^(?:conversa sem t[íi]tulo|sua busca|nova busca|nova conversa|produto|produtos|conversa de \d{2}\/\d{2})$/i;
const GREETING_ONLY = /^(?:oi+|ol[áa]|bom dia|boa tarde|boa noite|hey|e a[ií]|tudo bem)[\s!.,]*$/i;
const GREETING_PREFIX = /^(?:oi+|ol[áa]|bom dia|boa tarde|boa noite|hey|e a[ií]|tudo bem)[\s!.,;:-]+/i;
const MAX_TITLE_LENGTH = 48;

/**
 * Título a partir da primeira mensagem da conversa. É o que identifica a
 * conversa no histórico; uma data genérica não ajuda a escolher qual abrir.
 */
function deriveTitleFromTurns(turns: unknown): string {
  const list = Array.isArray(turns) ? turns : [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const query = typeof (raw as { query?: unknown }).query === 'string' ? (raw as { query: string }).query : '';
    let text = query
      .trim()
      .replace(/\s+/g, ' ')
      .replace(GREETING_PREFIX, '')
      .replace(/[?!.,;:]+$/g, '')
      .trim();
    if (text.length < 3 || GREETING_ONLY.test(text) || PLACEHOLDER_TITLE.test(text)) continue;
    if (text.length > MAX_TITLE_LENGTH) {
      text = text.slice(0, MAX_TITLE_LENGTH).replace(/\s+\S*$/, '').trim();
    }
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
  return '';
}

/** O título salvo só vale se não for um marcador genérico. */
function meaningfulTitle(value: string | null | undefined): string {
  const text = titleOf(value);
  return text && !PLACEHOLDER_TITLE.test(text) ? text : '';
}

function sessionTitleOf(title: string | null | undefined, turns: unknown): string {
  return meaningfulTitle(title) || deriveTitleFromTurns(turns) || 'Conversa sem título';
}

/** Normaliza o jsonb que entra: só turnos conhecidos, com teto por sessão. */
export function sanitizeSessionTurns(value: unknown): DiscoverySessionTurn[] {
  if (!Array.isArray(value)) return [];
  const turns: DiscoverySessionTurn[] = [];
  for (const raw of value.slice(-MAX_SESSION_TURNS)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const turn = raw as Record<string, unknown>;
    const products = (Array.isArray(turn.products) ? turn.products : [])
      .filter((product): product is Record<string, unknown> =>
        !!product && typeof product === 'object' && !Array.isArray(product) && typeof product.id === 'string')
      .slice(0, MAX_TURN_PRODUCTS);
    turns.push({
      query: typeof turn.query === 'string' ? turn.query.slice(0, 500) : '',
      message: typeof turn.message === 'string' ? turn.message.slice(0, 8000) : '',
      products,
      needs_clarification: Boolean(turn.needs_clarification),
      image_name: typeof turn.image_name === 'string' ? turn.image_name.slice(0, 300) : null,
    });
  }
  return turns;
}

function summaryOf(row: Pick<SessionRow, 'id' | 'title' | 'context' | 'turns' | 'created_at' | 'updated_at'>): DiscoverySessionSummary {
  return {
    id: row.id,
    // Sessões antigas guardaram título vazio ou uma data: o histórico usa a
    // primeira mensagem, que continua salva nos turnos.
    title: sessionTitleOf(row.title, row.turns),
    context: row.context || 'discover',
    turn_count: Array.isArray(row.turns) ? row.turns.length : 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function arrayOf<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export async function listSessions(creatorId: string, limit = MAX_SESSIONS_PER_CREATOR): Promise<DiscoverySessionSummary[]> {
  const { data, error } = await supabaseAdmin
    .from('discovery_sessions')
    .select('id, title, context, turns, created_at, updated_at')
    .eq('creator_id', creatorId)
    .order('updated_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), MAX_SESSIONS_PER_CREATOR));
  if (error) throw error;
  return (data ?? []).map((row) => summaryOf(row as SessionRow));
}

export async function getSession(creatorId: string, id: string): Promise<DiscoverySession> {
  const { data, error } = await supabaseAdmin
    .from('discovery_sessions')
    .select('id, title, context, turns, created_at, updated_at')
    .eq('id', id)
    .eq('creator_id', creatorId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw Errors.NOT_FOUND('Conversa');
  const row = data as SessionRow;
  return {
    ...summaryOf(row),
    turns: arrayOf<DiscoverySessionTurn>(row.turns),
  };
}

export interface CreateSessionInput {
  creatorId: string;
  userId: string;
  title?: string | null;
  context?: string | null;
  turns?: unknown;
}

/**
 * Cria a sessão na primeira busca da conversa. Falha de persistência não
 * derruba a busca: a resposta já foi entregue ao usuário e o next turno tenta
 * de novo com todos os turnos em memória.
 */
export async function createSession(input: CreateSessionInput): Promise<DiscoverySessionSummary | null> {
  try {
    const turns = sanitizeSessionTurns(input.turns);
    const { data, error } = await supabaseAdmin
      .from('discovery_sessions')
      .insert({
        creator_id: input.creatorId,
        user_id: input.userId,
        title: sessionTitleOf(input.title, turns),
        context: titleOf(input.context) || 'discover',
        turns,
        updated_at: new Date().toISOString(),
      })
      .select('id, title, context, turns, created_at, updated_at')
      .maybeSingle();
    if (error) {
      logger.warn({ err: error }, 'Failed to create discovery session');
      return null;
    }
    return summaryOf(data as SessionRow);
  } catch (err) {
    logger.warn({ err }, 'Failed to create discovery session');
    return null;
  }
}

export interface UpdateSessionInput {
  title?: string | null;
  context?: string | null;
  turns?: unknown;
}

/**
 * Salva a conversa após cada turno. Falha não derruba a conversa: o turno
 * seguinte reenvia todos os turnos em memória.
 */
export async function updateSession(
  creatorId: string,
  id: string,
  patch: UpdateSessionInput,
): Promise<DiscoverySessionSummary | null> {
  try {
    const values: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.title !== undefined) values.title = sessionTitleOf(patch.title, patch.turns);
    if (patch.context !== undefined && titleOf(patch.context)) values.context = titleOf(patch.context);
    if (patch.turns !== undefined) values.turns = sanitizeSessionTurns(patch.turns);
    const { data, error } = await supabaseAdmin
      .from('discovery_sessions')
      .update(values)
      .eq('id', id)
      .eq('creator_id', creatorId)
      .select('id, title, context, turns, created_at, updated_at')
      .maybeSingle();
    if (error) {
      logger.warn({ err: error }, 'Failed to update discovery session');
      return null;
    }
    if (!data) return null;
    return summaryOf(data as SessionRow);
  } catch (err) {
    logger.warn({ err }, 'Failed to update discovery session');
    return null;
  }
}

export async function deleteSession(creatorId: string, id: string): Promise<{ id: string; deleted: boolean }> {
  const { data } = await supabaseAdmin
    .from('discovery_sessions')
    .delete()
    .eq('id', id)
    .eq('creator_id', creatorId)
    .select('id');
  return { id, deleted: Array.isArray(data) && data.length > 0 };
}

export async function clearSessions(creatorId: string): Promise<{ deleted: number }> {
  const { data, error } = await supabaseAdmin
    .from('discovery_sessions')
    .delete()
    .eq('creator_id', creatorId)
    .select('id');
  if (error) throw error;
  return { deleted: Array.isArray(data) ? data.length : 0 };
}
