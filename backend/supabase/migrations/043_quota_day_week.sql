-- 043_quota_day_week.sql
-- Cotas do plano Grátis passam a renovar:
--   buscas: por dia local (meia-noite de Brasília);
--   roteiros: por semana local (segunda-feira).
-- O backend envia a data/janela calculada em America/Sao_Paulo; nada depende
-- do CURRENT_DATE em UTC.

create or replace function public.reserve_ai_quota_on(
  p_user_id uuid,
  p_kind text,
  p_daily_limit integer,
  p_usage_date date
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  affected integer;
begin
  if p_kind not in ('assistant', 'kit') or p_daily_limit < 1 then
    raise exception 'Invalid AI quota parameters';
  end if;

  insert into ai_usage_daily (user_id, usage_date)
  values (p_user_id, p_usage_date)
  on conflict (user_id, usage_date) do nothing;

  if p_kind = 'assistant' then
    update ai_usage_daily
    set assistant_calls = assistant_calls + 1, atualizado_em = now()
    where user_id = p_user_id
      and usage_date = p_usage_date
      and assistant_calls < p_daily_limit;
  else
    update ai_usage_daily
    set kit_calls = kit_calls + 1, atualizado_em = now()
    where user_id = p_user_id
      and usage_date = p_usage_date
      and kit_calls < p_daily_limit;
  end if;

  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

create or replace function public.release_ai_quota_on(
  p_user_id uuid,
  p_kind text,
  p_usage_date date
)
returns void
language sql
security definer
set search_path to 'public'
as $$
  update ai_usage_daily
  set assistant_calls = case when p_kind = 'assistant' then greatest(assistant_calls - 1, 0) else assistant_calls end,
      kit_calls = case when p_kind = 'kit' then greatest(kit_calls - 1, 0) else kit_calls end,
      atualizado_em = now()
  where user_id = p_user_id and usage_date = p_usage_date;
$$;

create or replace function public.reserve_free_kit_quota_week(
  p_user_id uuid,
  p_limit integer,
  p_week_start date,
  p_usage_date date
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  used integer;
begin
  if p_limit < 1 then
    raise exception 'Invalid free kit quota';
  end if;

  -- Serializa a semana por usuário: duas gerações simultâneas não furam o teto.
  perform pg_advisory_xact_lock(hashtext(p_user_id::text)::bigint);

  select coalesce(sum(kit_calls), 0) into used
  from ai_usage_daily
  where user_id = p_user_id
    and usage_date >= p_week_start
    and usage_date <= p_usage_date;

  if used >= p_limit then
    return false;
  end if;

  insert into ai_usage_daily (user_id, usage_date)
  values (p_user_id, p_usage_date)
  on conflict (user_id, usage_date) do nothing;

  update ai_usage_daily
  set kit_calls = kit_calls + 1, atualizado_em = now()
  where user_id = p_user_id and usage_date = p_usage_date;

  return true;
end;
$$;

revoke all on function public.reserve_ai_quota_on(uuid, text, integer, date) from public, anon, authenticated;
revoke all on function public.release_ai_quota_on(uuid, text, date) from public, anon, authenticated;
revoke all on function public.reserve_free_kit_quota_week(uuid, integer, date, date) from public, anon, authenticated;

grant execute on function public.reserve_ai_quota_on(uuid, text, integer, date) to service_role;
grant execute on function public.release_ai_quota_on(uuid, text, date) to service_role;
grant execute on function public.reserve_free_kit_quota_week(uuid, integer, date, date) to service_role;
