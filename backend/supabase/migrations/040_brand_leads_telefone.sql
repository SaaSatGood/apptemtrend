-- 040_brand_leads_telefone.sql
-- O formulário fala em "telefone"; padroniza o nome da coluna.

alter table public.brand_leads
  rename column whatsapp to telefone;
