-- 027_analytics_events.sql
-- Eventos de funil: ativação, TTV/TTFV (tempo até o primeiro kit), passos do
-- onboarding e publicação. Escrita exclusiva pela API (service role); RLS
-- habilitada sem policies bloqueia leitura/escrita direta de anon/authenticated.
create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  props jsonb not null default '{}'::jsonb,
  path text,
  created_at timestamptz not null default now(),
  constraint analytics_events_name_len check (char_length(name) <= 60),
  constraint analytics_events_props_size check (pg_column_size(props) <= 4096)
);

create index if not exists analytics_events_name_created_idx
  on public.analytics_events (name, created_at desc);

create index if not exists analytics_events_user_created_idx
  on public.analytics_events (user_id, created_at desc);

alter table public.analytics_events enable row level security;
