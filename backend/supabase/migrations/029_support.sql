-- 029_support.sql
-- Canal de suporte in-app (tickets + mensagens) ligado ao painel admin,
-- limpeza do resíduo de "avulso" (kits_extra) e função de funil para o admin.
-- Escrita exclusiva pela API (service role); RLS sem policies bloqueia
-- acesso direto de anon/authenticated.

alter table public.creators
  drop column if exists kits_extra;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  user_id uuid not null,
  subject text not null,
  category text not null default 'outro',
  -- open (aguardando suporte) | answered (suporte respondeu) | resolved | closed
  status text not null default 'open',
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_tickets_creator_idx
  on public.support_tickets (creator_id, last_message_at desc);

create index if not exists support_tickets_status_idx
  on public.support_tickets (status, last_message_at desc);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  -- creator | support
  author text not null,
  author_user_id uuid,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists support_messages_ticket_idx
  on public.support_messages (ticket_id, created_at);

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;

-- Funil de eventos para o painel admin: contagem por evento nos últimos N dias.
-- Só o service role executa (a API decide quem é admin).
create or replace function public.analytics_funnel(p_days int default 30)
returns table (event_name text, total bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select name as event_name, count(*)::bigint as total
  from public.analytics_events
  where created_at >= now() - make_interval(days => greatest(p_days, 1))
  group by name
  order by total desc;
$$;

revoke all on function public.analytics_funnel(int) from public, anon, authenticated;
grant execute on function public.analytics_funnel(int) to service_role;
