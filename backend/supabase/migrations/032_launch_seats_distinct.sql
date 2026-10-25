-- 032_launch_seats_distinct.sql
-- Renovação de cliente de lançamento herda a mesma vaga. Contar linhas em vez
-- de vagas distintas faria uma renovação "gastar" duas vagas do lote de 100.

create or replace function public.launch_seats_used()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct s.launch_seat)::int
  from public.subscriptions s
  where s.launch_seat is not null
    and (
      (s.status in ('active', 'past_due') and s.current_period_end > now())
      or (s.status = 'pending' and s.created_at > now() - interval '24 hours')
    );
$$;

revoke all on function public.launch_seats_used() from public;
grant execute on function public.launch_seats_used() to service_role;
