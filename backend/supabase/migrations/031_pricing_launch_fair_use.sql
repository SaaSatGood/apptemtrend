-- 031_pricing_launch_fair_use.sql
-- Preço de lançamento para os primeiros 100 clientes ativos e forma de
-- pagamento (recorrente ou avulsa por período). O teto de uso justo fica no
-- backend; a tabela pública de planos não exibe números.

alter table public.subscriptions
  add column if not exists billing_mode text not null default 'recurring',
  add column if not exists launch_price boolean not null default false,
  add column if not exists launch_seat integer;

create index if not exists subscriptions_launch_seat_idx
  on public.subscriptions (launch_seat)
  where launch_seat is not null;

-- Reserva atômica de uma das 100 vagas. Conta apenas assinaturas ativas (ou
-- pending com checkout recente). A advisory lock evita duas vendas na última
-- vaga em checkouts simultâneos.
create or replace function public.claim_launch_seat(p_subscription_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seat integer;
begin
  perform pg_advisory_xact_lock(918273645);

  select min(candidate)
    into v_seat
  from generate_series(1, 100) as candidate
  where not exists (
    select 1
    from public.subscriptions s
    where s.launch_seat = candidate
      and (
        (s.status in ('active', 'past_due') and s.current_period_end > now())
        or (s.status = 'pending' and s.created_at > now() - interval '24 hours')
      )
  );

  if v_seat is null then
    return null;
  end if;

  update public.subscriptions
    set launch_seat = v_seat,
        launch_price = true,
        updated_at = now()
  where id = p_subscription_id
    and status = 'pending';

  if not found then
    return null;
  end if;

  return v_seat;
end;
$$;

create or replace function public.launch_seats_used()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.subscriptions s
  where s.launch_seat is not null
    and (
      (s.status in ('active', 'past_due') and s.current_period_end > now())
      or (s.status = 'pending' and s.created_at > now() - interval '24 hours')
    );
$$;

revoke all on function public.claim_launch_seat(uuid) from public;
revoke all on function public.launch_seats_used() from public;
grant execute on function public.claim_launch_seat(uuid) to service_role;
grant execute on function public.launch_seats_used() to service_role;
