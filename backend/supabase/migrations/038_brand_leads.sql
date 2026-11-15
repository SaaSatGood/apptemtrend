-- 038_brand_leads.sql
-- Cadastro de marcas/lojistas interessados em publicar produtos no catálogo.
-- A landing envia o formulário sem login; a escrita é exclusiva da API
-- (service role), então RLS sem policies bloqueia anon/authenticated.

create table if not exists public.brand_leads (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  empresa text not null,
  email text not null,
  whatsapp text not null,
  -- 1-10 | 11-50 | 51-200 | 200+ | iniciando
  catalogo text not null default 'iniciando',
  mensagem text,
  -- novo | contatado | cadastrado | descartado
  status text not null default 'novo',
  source text not null default 'landing_marcas',
  user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists brand_leads_created_idx
  on public.brand_leads (created_at desc);

-- Deduplicação por e-mail na janela de 24h.
create index if not exists brand_leads_email_created_idx
  on public.brand_leads (email, created_at desc);

create index if not exists brand_leads_status_idx
  on public.brand_leads (status, created_at desc);

alter table public.brand_leads enable row level security;
