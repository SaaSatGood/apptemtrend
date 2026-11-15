-- 036_shared_conversations.sql
-- Link compartilhavel de conversa do Descobrir: o creator termina uma busca
-- (ou uma conversa com varios turnos) e gera um link para outra pessoa ver a
-- conversa -- como chatbot ou como roteiro -- e abrir a tela de gravar conteudo.
-- Escrita/leitura exclusivas pela API (service role); RLS sem policies bloqueia
-- acesso direto de anon/authenticated, como em discovery_searches.

create table if not exists public.shared_conversations (
  id uuid primary key default gen_random_uuid(),
  -- Token curto e dificil de adivinhar: e o endereco publico do link.
  slug text not null unique,
  creator_id uuid not null references public.creators(id) on delete cascade,
  user_id uuid not null,
  title text not null default '',
  -- Retrato da conversa: [{ query, message, products, needs_clarification, image_name }].
  turns jsonb not null default '[]'::jsonb,
  turn_count integer not null default 0,
  product_count integer not null default 0,
  -- Revogar desativa o link sem apagar o historico do creator.
  revoked boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists shared_conversations_creator_recent_idx
  on public.shared_conversations (creator_id, criado_em desc);

alter table public.shared_conversations enable row level security;

revoke all on table public.shared_conversations from anon, authenticated;

-- Roteiro copiado para o workspace de quem recebeu o link. Guarda a origem
-- para que abrir o mesmo link duas vezes nao duplique o roteiro de ninguem.
alter table public.content_kits
  add column if not exists source_kit_id uuid references public.content_kits(id) on delete set null;

create index if not exists content_kits_source_kit_idx
  on public.content_kits (source_kit_id);
