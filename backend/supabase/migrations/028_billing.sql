-- 028_billing.sql
-- Assinaturas (AbacatePay), estado de plano do creator e trilha de eventos de
-- billing. Escrita exclusiva pela API (service role); RLS sem policies bloqueia
-- acesso direto de anon/authenticated.

alter table public.creators
  add column if not exists plan text not null default 'free',
  add column if not exists plan_status text not null default 'inactive',
  add column if not exists plan_period text,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists current_period_end timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists provider_customer_id text,
  add column if not exists kits_extra integer not null default 0;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  plan text not null,
  period text not null,
  status text not null default 'pending',
  provider text not null default 'abacatepay',
  provider_checkout_id text,
  provider_subscription_id text,
  amount_cents integer,
  current_period_end timestamptz,
  started_at timestamptz,
  canceled_at timestamptz,
  pending_plan text,
  pending_period text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_creator_created_idx
  on public.subscriptions (creator_id, created_at desc);

create unique index if not exists subscriptions_checkout_uidx
  on public.subscriptions (provider_checkout_id)
  where provider_checkout_id is not null;

create table if not exists public.billing_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;
alter table public.billing_events enable row level security;
