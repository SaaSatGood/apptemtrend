-- 042_password_recovery.sql
-- Separa os códigos por finalidade (cadastro x redefinição de senha), para que
-- um código de cadastro nunca sirva para trocar senha (e vice-versa).
alter table public.email_verification_codes
  add column if not exists purpose text not null default 'signup';

alter table public.email_verification_codes
  drop constraint if exists email_verification_codes_purpose_check;

alter table public.email_verification_codes
  add constraint email_verification_codes_purpose_check
  check (purpose in ('signup', 'password_reset'));

create index if not exists email_verification_codes_email_purpose_idx
  on public.email_verification_codes (email, purpose, created_at desc);

-- Identidade completa por e-mail: distingue conta criada manualmente (tem
-- identidade provider='email') de conta só Google. O reset de senha usa
-- apenas as contas com credencial de e-mail.
create or replace function public.auth_user_identity_by_email(p_email text)
returns table (user_id uuid, email_confirmed boolean, has_password boolean)
language sql
security definer
set search_path = ''
stable
as $$
  select
    u.id,
    (u.email_confirmed_at is not null),
    exists (
      select 1
      from auth.identities i
      where i.user_id = u.id and i.provider = 'email'
    )
  from auth.users u
  where lower(u.email) = lower(p_email)
  limit 1;
$$;

revoke all on function public.auth_user_identity_by_email(text) from public, anon, authenticated;
grant execute on function public.auth_user_identity_by_email(text) to service_role;
