# Operações e runbook — TemTrend

**Atualizado em:** 13/11/2026
**Público:** quem opera produção (Render, Vercel, Supabase, AbacatePay e Asaas).

## 1. Sinais de saúde

| Sinal | Endpoint | Esperado | Se falhar |
|---|---|---|---|
| Liveness | `GET /health` | `200 {"status":"ok"}` | Reiniciar o serviço no Render e conferir logs de boot |
| Readiness | `GET /ready` | `200` com `database: ok` | Conferir Supabase (pausa, credenciais, RLS) e rede do Render |
| Catálogo | `GET /billing/plans` | `200`; `enabled` reflete as chaves de cobrança | Conferir `ABACATEPAY_API_KEY`/`ASAAS_API_KEY` |
| Funil | `POST /events` | `202` | 400 = nome de evento fora da lista fechada; 429 = limite |

O GitHub Actions mantém um keepalive em `/health` e `/ready`. **Configure um
alerta externo** (UptimeRobot, Better Stack ou similar) para `/ready`. A API
também envia um alerta best-effort para `ALERT_WEBHOOK_URL` (Slack/Discord) em
todo erro 5xx, com rota, status, código e request id — nunca com corpo do
request, token ou dado pessoal. Sem a env, o alerta fica só nos logs do Render.

## 2. Pagamentos

- **PIX/assinatura:** AbacatePay (`/billing/webhook?webhookSecret=...`).
- **Cartão recorrente:** Asaas (`/billing/webhook/asaas`, header
  `asaas-access-token`).
- Webhooks são idempotentes por `billing_events`; reenviar o mesmo evento
  responde `duplicate`.
- O evento Asaas só altera uma assinatura quando encontra vínculo explícito por
  `externalReference`, `subscription` ou `checkout`. Sem vínculo, é ignorado e
  logado — **nunca** ativa a assinatura pendente de outra conta.
- **Reconciliação manual:** se um cliente pagou e o plano não ativou, localize a
  assinatura por e-mail no painel do provedor, confira o `externalReference`
  (id da linha em `subscriptions`) e reenvie o evento pelo painel. Se o vínculo
  não existir, crie/atualize a linha antes de reenviar.

## 3. Supabase

- Migrations são **manuais** no SQL Editor, em ordem crescente
  (`backend/supabase/migrations/README.md`).
- RLS habilitada sem policies nas tabelas de infraestrutura: só a API
  (service role) acessa. Não criar policies públicas sem revisão.
- Funções de cota (`reserve_*`) são `security definer`, com `search_path`
  fixo e execução restrita a `service_role`.
- Backups: o plano Free não tem backup diário. Antes de escalar receita,
  subir para o Pro.

## 4. Retenção de dados

A política de privacidade promete o mínimo necessário. Enquanto não houver job
automatizado, faça a limpeza periódica (sugestão: trimestral) com janelas
conservadoras:

```sql
-- Eventos de funil: manter 24 meses
delete from public.analytics_events where created_at < now() - interval '24 months';

-- Eventos de billing: manter 5 anos (obrigação fiscal/contábil)
delete from public.billing_events where received_at < now() - interval '5 years';

-- Histórico de buscas do Descobrir: manter 12 meses
delete from public.discovery_searches where created_at < now() - interval '12 months';
```

> Confirme os nomes das colunas de data no schema antes de rodar. Rode em
> transação e com `limit`/`ctid` em lotes se a tabela estiver grande.

## 5. IA e custo

- Provedor principal: `AI_PROVIDER` (padrão `gemini`), com fallback em cadeia e
  roteiro determinístico se todos falharem.
- `GET /admin/ai-usage` mostra tokens por operação. Toda tentativa de geração
  que consumiu tokens é contabilizada, inclusive as descartadas pelos
  guardrails.
- Tetos internos de uso justo: 1.000 kits/mês e 1.000 buscas/dia no Pro; 40
  mensagens/dia no suporte; Grátis 100 buscas e 10 roteiros por semana.
- Se o custo de IA passar de 10% da receita líquida, reduza
  `AI_LIMITS.MAX_CATALOG_ITEMS`/`GENERATE_MAX_OUTPUT_TOKENS` ou migre o modelo.

## 6. Cold start

O Render Free dorme e o primeiro acesso pode levar 30–50 s. O cliente já espera
até 45 s no primeiro `/me`, mas o certo é subir para **Starter** antes do
lançamento. Enquanto isso, avise o time de suporte que o primeiro acesso do dia
pode demorar.

## 7. Incidentes de segurança

1. Revogar a chave exposta no provedor (Supabase/Render/Vercel/AbacatePay/Asaas/Resend).
2. Invalidar sessões comprometidas (`clearAuthCachesForUser` + logout no Supabase).
3. Avaliar dados afetados e comunicar titulares/ANPD quando aplicável (LGPD art. 48).
4. Registrar o ocorrido e a correção no canal interno.
