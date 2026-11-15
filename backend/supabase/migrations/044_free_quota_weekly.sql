-- 044_free_quota_weekly.sql
-- Todo o plano Grátis (buscas e roteiros) renova em uma única janela semanal,
-- de segunda a domingo no fuso America/Sao_Paulo. A cota diária de 24h deixa
-- de existir para o Grátis; os planos pagos seguem com suas guardas próprias.

create or replace function public.reserve_free_quota_week(
  p_user_id uuid,
  p_kind text,
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
  if p_kind not in ('assistant', 'kit') or p_limit < 1 then
    raise exception 'Invalid free quota parameters';
  end if;

  -- Serializa a semana por usuário e tipo: requisições simultâneas não furam o teto.
  perform pg_advisory_xact_lock(hashtext(p_user_id::text || ':' || p_kind)::bigint);

  if p_kind = 'assistant' then
    select coalesce(sum(assistant_calls), 0) into used
    from ai_usage_daily
    where user_id = p_user_id
      and usage_date >= p_week_start
      and usage_date <= p_usage_date;
  else
    select coalesce(sum(kit_calls), 0) into used
    from ai_usage_daily
    where user_id = p_user_id
      and usage_date >= p_week_start
      and usage_date <= p_usage_date;
  end if;

  if used >= p_limit then
    return false;
  end if;

  insert into ai_usage_daily (user_id, usage_date)
  values (p_user_id, p_usage_date)
  on conflict (user_id, usage_date) do nothing;

  if p_kind = 'assistant' then
    update ai_usage_daily
    set assistant_calls = assistant_calls + 1, atualizado_em = now()
    where user_id = p_user_id and usage_date = p_usage_date;
  else
    update ai_usage_daily
    set kit_calls = kit_calls + 1, atualizado_em = now()
    where user_id = p_user_id and usage_date = p_usage_date;
  end if;

  return true;
end;
$$;

revoke all on function public.reserve_free_quota_week(uuid, text, integer, date, date) from public, anon, authenticated;
grant execute on function public.reserve_free_quota_week(uuid, text, integer, date, date) to service_role;
