-- 030_discovery_searches.sql
-- Histórico de buscas do Descobrir (por creator), no estilo do histórico de
-- conversas do ChatGPT: cada busca guarda o texto, a resposta da IA e os
-- produtos exibidos, para reabrir o resultado sem gastar cota nem chamar a IA.
-- Escrita/leitura exclusivas pela API (service role); RLS sem policies bloqueia
-- acesso direto de anon/authenticated.

create table if not exists public.discovery_searches (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  user_id uuid not null,
  query text not null,
  -- Texto normalizado (sem acento, minúsculo) para deduplicar a mesma busca.
  query_key text not null,
  message text not null default '',
  results jsonb not null default '[]'::jsonb,
  context_ids jsonb not null default '[]'::jsonb,
  needs_clarification boolean not null default false,
  result_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Repetir a mesma busca atualiza a entrada existente em vez de duplicar.
create unique index if not exists discovery_searches_creator_query_key_idx
  on public.discovery_searches (creator_id, query_key);

create index if not exists discovery_searches_creator_recent_idx
  on public.discovery_searches (creator_id, updated_at desc);

alter table public.discovery_searches enable row level security;

revoke all on table public.discovery_searches from anon, authenticated;
