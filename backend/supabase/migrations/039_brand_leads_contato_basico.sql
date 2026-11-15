-- 039_brand_leads_contato_basico.sql
-- O formulário da landing ficou no básico: nome, e-mail, telefone e mensagem.
-- A tabela ainda não tem dados, então as colunas que deixaram de ser
-- coletadas saem do modelo.

alter table public.brand_leads
  drop column if exists empresa,
  drop column if exists catalogo;

alter table public.brand_leads
  alter column mensagem set not null;
