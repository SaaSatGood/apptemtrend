alter table public.creator_content
  add column if not exists scheduled_for date;

-- Datas gravadas antes da migration usam uma marca interna no fim de notas.
update public.creator_content
set scheduled_for = substring(notas from '\[temtrend:scheduled_for=([0-9]{4}-[0-9]{2}-[0-9]{2})\]$')::date,
    notas = nullif(regexp_replace(notas, '\n?\[temtrend:scheduled_for=[0-9]{4}-[0-9]{2}-[0-9]{2}\]$', ''), '')
where notas ~ '\[temtrend:scheduled_for=[0-9]{4}-[0-9]{2}-[0-9]{2}\]$';

create index if not exists creator_content_creator_schedule_idx
  on public.creator_content (creator_id, scheduled_for)
  where scheduled_for is not null;

comment on column public.creator_content.scheduled_for is
  'Data editorial planejada pelo creator para gravar ou publicar este conteúdo.';
