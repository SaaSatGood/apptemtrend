# Migrations

Schema canônico do PostgreSQL (Supabase). Cada arquivo é aplicado **manualmente**
no SQL Editor do projeto, em ordem crescente de prefixo, e o histórico fica
registrado aqui — não existe tabela de controle de migrations no banco.

## Convenção

- Nome: `NNN_descricao_curta.sql` (três dígitos, `snake_case`).
- Sempre idempotente quando possível: `IF NOT EXISTS`, `CREATE OR REPLACE`,
  `DROP ... IF EXISTS`. Isso permite reaplicar em ambientes já migrados sem
  quebrar.
- Uma migration por mudança coesa. Não edite uma migration já aplicada em
  produção: corrija com uma nova.
- Funções `SECURITY DEFINER` devem fixar `SET search_path = public` e revogar
  execução de `PUBLIC`, liberando só para `service_role` (ver `035`).

## Estado atual

Última migration no repositório: `045_quota_support_kind.sql`.

**Status verificado em 13/11/2026** no projeto Supabase configurado
(`iwktyugnwtdroberoces`): o schema necessário ao código atual está aplicado —
`creator_content.scheduled_for`, `ai_usage_daily.support_calls`,
`shared_conversations`, `content_kits.source_kit_id`, cota semanal do Grátis e
as funções de cota do suporte. O catálogo tem ~3,7 mil produtos ativos.

> `033_import_fastmoss_product_searches_20261025.sql` é um import de dados
> idempotente (upsert por `produto_externo_id`). O catálogo de produção já
> reflete a carga (3,7 mil produtos), mas o prefixo não aparece no histórico
> automático porque a aplicação é manual. Reaplicar é seguro.

Se produção usa outro projeto Supabase, revalide lá antes de considerar qualquer
linha abaixo como aplicada.

| Prefixo | Arquivo | Status | Observação |
| --- | --- | --- | --- |
| 022 | `022_persistent_ai_controls.sql` | aplicada | — |
| 023 | `023_import_fastmoss_catalog_20261010.sql` | aplicada | dados de catálogo |
| 024 | `024_import_fastmoss_catalog_20261010_0359.sql` | aplicada | dados de catálogo |
| 025 | `025_creator_voz.sql` | aplicada | — |
| 026 | `026_import_fastmoss_catalog_20261018.sql` | aplicada | dados de catálogo |
| 027 | `027_analytics_events.sql` | aplicada | ver nota de numeração |
| 027 | `027_import_fastmoss_product_searches_20261018.sql` | aplicada | ver nota de numeração |
| 028 | `028_billing.sql` | aplicada | — |
| 029 | `029_support.sql` | aplicada | — |
| 030 | `030_discovery_searches.sql` | aplicada | — |
| 031 | `031_pricing_launch_fair_use.sql` | aplicada | — |
| 032 | `032_launch_seats_distinct.sql` | aplicada | — |
| 033 | `033_import_fastmoss_product_searches_20261025.sql` | dados já no catálogo | import idempotente; não aparece no histórico automático |
| 034 | `034_creator_content_schedule.sql` | aplicada | cria `creator_content.scheduled_for` |
| 035 | `035_support_ai_quota.sql` | aplicada | cota diária de IA do suporte (`ai_usage_daily.support_calls`) |
| 036 | `036_shared_conversations.sql` | aplicada | links compartilháveis + `content_kits.source_kit_id` |
| 037 | `037_discovery_sessions.sql` | aplicada | sessões do Descobrir |
| 038 | `038_brand_leads.sql` | aplicada | leads de marcas/lojistas |
| 039 | `039_brand_leads_contato_basico.sql` | aplicada | contato básico do lead |
| 040 | `040_brand_leads_telefone.sql` | aplicada | telefone do lead |
| 041 | `041_email_verification_codes.sql` | aplicada | códigos de confirmação de e-mail |
| 042 | `042_password_recovery.sql` | aplicada | recuperação de senha por código |
| 043 | `043_quota_day_week.sql` | aplicada | cotas por data/janela local |
| 044 | `044_free_quota_weekly.sql` | aplicada | cota semanal única do Grátis |
| 045 | `045_quota_support_kind.sql` | aplicada | corrige `reserve_ai_quota_on`/`release_ai_quota_on` para aceitar `support` |

> **Por que a 045 existe:** a `043` recriou `reserve_ai_quota_on` aceitando
> apenas `assistant` e `kit`. O backend usa essa função com `p_kind='support'`
> no chat de suporte; sem a `045`, a rota responde 500 com
> `AI_QUOTA_STORE=database`. A `045` adiciona a coluna `support_calls` (como a
> `035`) e regrava as duas funções com o terceiro contador.

## Nota: prefixo `027` duplicado

Existem dois arquivos com o prefixo `027`:

- `027_analytics_events.sql`
- `027_import_fastmoss_product_searches_20261018.sql`

Ambos já foram aplicados em produção (nessa ordem) e são independentes entre si.
**Não renumeramos** porque o histórico de aplicação é manual e um rename
impediria correlacionar o que está no banco com o repositório. Novas migrations
devem continuar a partir de `046`.

## Checklist para uma nova migration

1. Criar o arquivo com o próximo prefixo livre.
2. Escrever SQL idempotente e testar em um branch do Supabase.
3. Aplicar em produção no SQL Editor.
4. Atualizar a tabela de status acima (`pendente` → `aplicada`).
5. Atualizar o número da última migration no `README.md` da raiz.
