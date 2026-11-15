-- 037_discovery_sessions.sql
-- Sessões do Descobrir: cada conversa do chatbot vira uma URL fixa
-- (/app/descobrir/{id}) que o criador reabre pelo histórico da sidebar.
-- A conversa inteira (turnos: pergunta, resposta e produtos) é guardada em
-- JSONB, então reabrir uma sessão não gasta cota nem chama a IA de novo.
-- Leitura/escrita exclusivas pela API (service role); RLS sem policies
-- bloqueia acesso direto de anon/authenticated, como nas demais tabelas de IA.

create table if not exists public.discovery_sessions (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  user_id uuid not null,
  title text not null default '',
  context text not null default 'discover',
  turns jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists discovery_sessions_creator_recent_idx
  on public.discovery_sessions (creator_id, updated_at desc);

alter table public.discovery_sessions enable row level security;

revoke all on table public.discovery_sessions from anon, authenticated;
