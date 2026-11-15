-- 041_email_verification_codes.sql
-- Código de 6 dígitos enviado por e-mail no cadastro. O código nunca é salvo
-- em texto puro: guardamos HMAC-SHA256 (pepper = service role key).
-- Escrita/leitura exclusiva da API (service role); RLS sem policies bloqueia
-- anon/authenticated.
create table if not exists public.email_verification_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email text not null,
  code_hash text not null,
  attempts smallint not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint email_verification_codes_email_len check (char_length(email) <= 254)
);

create index if not exists email_verification_codes_email_created_idx
  on public.email_verification_codes (email, created_at desc);

alter table public.email_verification_codes enable row level security;

-- Lookup pontual de auth.users por e-mail: o GoTrue Admin API não expõe
-- "getUserByEmail". SECURITY DEFINER com execute restrito ao service_role.
create or replace function public.auth_user_id_by_email(p_email text)
returns table (user_id uuid, email_confirmed boolean)
language sql
security definer
set search_path = ''
stable
as $$
  select u.id, (u.email_confirmed_at is not null)
  from auth.users u
  where lower(u.email) = lower(p_email)
  limit 1;
$$;

revoke all on function public.auth_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.auth_user_id_by_email(text) to service_role;
