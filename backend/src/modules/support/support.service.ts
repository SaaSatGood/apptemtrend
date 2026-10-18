import { supabaseAdmin } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';
import { PAGINATION } from '../../config/constants.js';
import { Errors, type Creator } from '../../types/index.js';
import { listUserDirectory } from '../admin/admin.repository.js';

/**
 * Canal de suporte in-app: o creator abre uma conversa e o time responde pelo
 * painel admin (mesmas tabelas). Escrita exclusiva pela API (service role).
 */

export const SUPPORT_CATEGORIES = ['duvida', 'problema', 'cobranca', 'sugestao', 'outro'] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

export const SUPPORT_STATUSES = ['open', 'answered', 'resolved', 'closed'] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

/** Conversas simultâneas (open/answered) por creator. */
const MAX_ACTIVE_TICKETS = 5;

export interface SupportTicketRow {
  id: string;
  creator_id: string;
  user_id: string;
  subject: string;
  category: string;
  status: string;
  last_message_at: string;
  created_at: string;
  updated_at: string;
}

export interface SupportMessageRow {
  id: string;
  ticket_id: string;
  author: string;
  author_user_id: string | null;
  body: string;
  created_at: string;
}

const TICKET_FIELDS = 'id, creator_id, user_id, subject, category, status, last_message_at, created_at, updated_at';
const MESSAGE_FIELDS = 'id, ticket_id, author, author_user_id, body, created_at';

export interface TicketView {
  id: string;
  subject: string;
  category: string;
  status: string;
  last_message_at: string;
  created_at: string;
}

export function ticketView(row: SupportTicketRow): TicketView {
  return {
    id: row.id,
    subject: row.subject,
    category: row.category,
    status: row.status,
    last_message_at: row.last_message_at,
    created_at: row.created_at,
  };
}

function messageView(row: SupportMessageRow) {
  return {
    id: row.id,
    author: row.author,
    body: row.body,
    created_at: row.created_at,
  };
}

async function fetchOwnedTicket(creatorId: string, ticketId: string): Promise<SupportTicketRow> {
  const { data, error } = await supabaseAdmin
    .from('support_tickets')
    .select(TICKET_FIELDS)
    .eq('id', ticketId)
    .eq('creator_id', creatorId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw Errors.NOT_FOUND('Conversa');
  return data as SupportTicketRow;
}

async function fetchMessages(ticketId: string): Promise<SupportMessageRow[]> {
  const { data, error } = await supabaseAdmin
    .from('support_messages')
    .select(MESSAGE_FIELDS)
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as SupportMessageRow[];
}

// ---------- Creator ----------

export async function createTicket(
  creator: Creator,
  input: { subject: string; category: SupportCategory; message: string },
): Promise<TicketView> {
  const { count, error: countError } = await supabaseAdmin
    .from('support_tickets')
    .select('id', { count: 'exact', head: true })
    .eq('creator_id', creator.id)
    .in('status', ['open', 'answered']);
  if (countError) throw countError;
  if ((count ?? 0) >= MAX_ACTIVE_TICKETS) {
    throw Errors.CONFLICT(
      `Você já tem ${MAX_ACTIVE_TICKETS} conversas abertas com o suporte. Aguarde uma resposta ou encerre uma delas.`,
    );
  }

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('support_tickets')
    .insert({
      creator_id: creator.id,
      user_id: creator.user_id,
      subject: input.subject,
      category: input.category,
      status: 'open',
      last_message_at: now,
      updated_at: now,
    })
    .select(TICKET_FIELDS)
    .single();
  if (error || !data) {
    logger.error({ err: error }, 'Failed to create support ticket');
    throw error ?? Errors.NOT_FOUND('Conversa');
  }
  const ticket = data as SupportTicketRow;
  const { error: messageError } = await supabaseAdmin
    .from('support_messages')
    .insert({ ticket_id: ticket.id, author: 'creator', author_user_id: creator.user_id, body: input.message });
  if (messageError) {
    logger.error({ err: messageError, ticket_id: ticket.id }, 'Failed to create first support message');
    throw messageError;
  }
  logger.info({ ticket_id: ticket.id, creator_id: creator.id, category: input.category }, 'Support ticket created');
  return ticketView(ticket);
}

export async function listCreatorTickets(creatorId: string): Promise<TicketView[]> {
  const { data, error } = await supabaseAdmin
    .from('support_tickets')
    .select(TICKET_FIELDS)
    .eq('creator_id', creatorId)
    .order('last_message_at', { ascending: false })
    .limit(PAGINATION.MAX_LIMIT);
  if (error) throw error;
  return ((data ?? []) as SupportTicketRow[]).map(ticketView);
}

export async function getCreatorTicket(creatorId: string, ticketId: string) {
  const ticket = await fetchOwnedTicket(creatorId, ticketId);
  const messages = await fetchMessages(ticket.id);
  return { ...ticketView(ticket), messages: messages.map(messageView) };
}

export async function addCreatorMessage(creator: Creator, ticketId: string, body: string) {
  const ticket = await fetchOwnedTicket(creator.id, ticketId);
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('support_messages')
    .insert({ ticket_id: ticket.id, author: 'creator', author_user_id: creator.user_id, body })
    .select(MESSAGE_FIELDS)
    .single();
  if (error || !data) {
    logger.error({ err: error, ticket_id: ticket.id }, 'Failed to append support message');
    throw error ?? Errors.NOT_FOUND('Conversa');
  }
  // Resposta do creator devolve a conversa para a fila do suporte (reabre se estava fechada).
  await supabaseAdmin
    .from('support_tickets')
    .update({ status: 'open', last_message_at: now, updated_at: now })
    .eq('id', ticket.id);
  return { status: 'open' as const, message: messageView(data as SupportMessageRow) };
}

export async function closeCreatorTicket(creatorId: string, ticketId: string) {
  const ticket = await fetchOwnedTicket(creatorId, ticketId);
  if (ticket.status === 'closed') {
    throw Errors.BAD_REQUEST('Esta conversa já está encerrada.');
  }
  await supabaseAdmin
    .from('support_tickets')
    .update({ status: 'closed', updated_at: new Date().toISOString() })
    .eq('id', ticket.id);
  logger.info({ ticket_id: ticket.id, creator_id: creatorId }, 'Support ticket closed by creator');
  return { ok: true as const, status: 'closed' as const };
}

// ---------- Admin ----------

export interface AdminTicketView extends TicketView {
  creator_id: string;
  creator_email: string | null;
  creator_nome: string | null;
}

async function enrichTickets(rows: SupportTicketRow[]): Promise<AdminTicketView[]> {
  if (rows.length === 0) return [];
  const creatorIds = [...new Set(rows.map((row) => row.creator_id))];
  const { data: creators, error } = await supabaseAdmin
    .from('creators')
    .select('id, user_id')
    .in('id', creatorIds);
  if (error) throw error;
  const userIdByCreator = new Map(
    ((creators ?? []) as Array<{ id: string; user_id: string }>).map((row) => [row.id, row.user_id]),
  );
  const directory = await listUserDirectory();
  return rows.map((row) => {
    const userId = userIdByCreator.get(row.creator_id);
    const user = userId ? directory.get(userId) : undefined;
    return {
      ...ticketView(row),
      creator_id: row.creator_id,
      creator_email: user?.email ?? null,
      creator_nome: user?.nome ?? null,
    };
  });
}

export async function listAdminTickets(query: {
  status?: SupportStatus;
  page: number;
  limit: number;
}): Promise<{ items: AdminTicketView[]; total: number; page: number; limit: number }> {
  const from = (query.page - 1) * query.limit;
  let request = supabaseAdmin
    .from('support_tickets')
    .select(TICKET_FIELDS, { count: 'exact' })
    .order('last_message_at', { ascending: false })
    .range(from, from + query.limit - 1);
  if (query.status) request = request.eq('status', query.status);
  const { data, error, count } = await request;
  if (error) throw error;
  const items = await enrichTickets((data ?? []) as SupportTicketRow[]);
  return { items, total: count ?? items.length, page: query.page, limit: query.limit };
}

export async function getAdminTicket(ticketId: string) {
  const { data, error } = await supabaseAdmin
    .from('support_tickets')
    .select(TICKET_FIELDS)
    .eq('id', ticketId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw Errors.NOT_FOUND('Conversa');
  const ticket = data as SupportTicketRow;
  const [messages, [enriched]] = await Promise.all([
    fetchMessages(ticket.id),
    enrichTickets([ticket]),
  ]);
  return { ...enriched, messages: messages.map(messageView) };
}

export async function replyAsSupport(ticketId: string, body: string, adminUserId: string) {
  const { data: ticketData, error } = await supabaseAdmin
    .from('support_tickets')
    .select(TICKET_FIELDS)
    .eq('id', ticketId)
    .maybeSingle();
  if (error) throw error;
  if (!ticketData) throw Errors.NOT_FOUND('Conversa');
  const ticket = ticketData as SupportTicketRow;
  const now = new Date().toISOString();
  const { data, error: insertError } = await supabaseAdmin
    .from('support_messages')
    .insert({ ticket_id: ticket.id, author: 'support', author_user_id: adminUserId, body })
    .select(MESSAGE_FIELDS)
    .single();
  if (insertError || !data) {
    logger.error({ err: insertError, ticket_id: ticket.id }, 'Failed to send support reply');
    throw insertError ?? Errors.NOT_FOUND('Conversa');
  }
  await supabaseAdmin
    .from('support_tickets')
    .update({ status: 'answered', last_message_at: now, updated_at: now })
    .eq('id', ticket.id);
  logger.info({ ticket_id: ticket.id, admin_user_id: adminUserId }, 'Support replied to ticket');
  return { status: 'answered' as const, message: messageView(data as SupportMessageRow) };
}

export async function setAdminTicketStatus(ticketId: string, status: SupportStatus) {
  const { data, error } = await supabaseAdmin
    .from('support_tickets')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', ticketId)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw Errors.NOT_FOUND('Conversa');
  logger.info({ ticket_id: ticketId, status }, 'Support ticket status updated');
  return { ok: true as const, status };
}
