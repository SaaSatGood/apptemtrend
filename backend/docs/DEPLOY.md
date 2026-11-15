# TemTrend — Deploy MVP (checklist)

## 1. Frontend (`frontend`)
O app é o Next.js App Router em `frontend/`. A versão estática anterior
(`legacy-static/`) foi removida; não há passo de build separado para HTML/JS.

- Deploy na Vercel com **Root Directory** = `frontend`, framework Next.js e
  build `npm run build`.
- Env obrigatórias: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  e `NEXT_PUBLIC_API_URL` (URL pública desta API).
- Detalhes de rotas e estrutura em [`frontend/README.md`](../../frontend/README.md).

## 2. Backend (`backend`) — deployado no Render (`temtrend-api`)
Env obrigatórias: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PORT`,
`NODE_ENV=production`, `CORS_ORIGIN` (separadas por vírgula, sem espaço extra —
o código faz trim), `FRONTEND_URL` (`https://www.temtrend.com`), `GEMINI_API_KEY`
(opcional; sem ela o assistant usa fallback local e a geração retorna 503
amigável), `GEMINI_MODEL`.

**Billing (atualizado em 13/11/2026):** `BILLING_ENABLED=true`,
`ABACATEPAY_WEBHOOK_SECRET` e `FRONTEND_URL` definidas no Render. Ainda faltam
as chaves de cobrança: **`ABACATEPAY_API_KEY`** (PIX) e/ou **`ASAAS_API_KEY`**
(cartão). Enquanto nenhuma existir, `billingActive()` fica `false` e o app roda
sem checkout; os limites do Grátis continuam valendo. Webhook v2 criado
(`webh_prod_xS6hzaujufu2sQxkpYpAZ434`). Passo a passo em
[`docs/go-live-billing.md`](../../docs/go-live-billing.md).

**E-mail transacional (obrigatório para cadastro):** `RESEND_API_KEY` e
`EMAIL_FROM` (remetente de domínio verificado). Sem eles, `POST /auth/signup`
responde 503 e desfaz a conta criada.

**Catálogo público:** um único plano pago, `pro` (R$ 49,90/mês ou R$ 499/ano).
A condição de lançamento (R$ 39,90/R$ 399) está encerrada para novas contratações
e é mantida apenas nas renovações de assinantes antigos. `enterprise` aparece
apenas como "Falar com a gente", sem preço, assentos ou SLA. Os IDs `essencial`
e `scale` continuam no código somente para assinaturas legadas.

**Produtos AbacatePay (recorrentes):**

| Oferta | Produto |
| --- | --- |
| Pro mensal | `prod_Jt2hbA4rBeCeGrbaPsUUEccb` |
| Pro anual | `prod_xR2MWUbe1AkdHqjK5EN6yPpJ` |
| Lançamento mensal | `prod_X35W1dnyXLA055ZewPZG6gMK` |
| Lançamento anual | `prod_gqppYRSSdKnHBZJKSBRpw0Jx` |

**Produtos AbacatePay (PIX avulso / fallback):**

| Oferta | Produto |
| --- | --- |
| Pro mensal | `prod_XxNqutEGTfFTs4QHxf2WtbpA` |
| Pro anual | `prod_SeQfXsLnBUxnZ0bBstzXZUE5` |
| Lançamento mensal | `prod_23bJx2ZaU3EsaHYLSRuL6Rt3` |
| Lançamento anual | `prod_XjpDTmMur4wqMQtZAJ0fGA5T` |

> **Limitação atual da loja:** a AbacatePay responde
> `PIX Automático is not available for this store` e
> `CARD is not available for this store`. O checkout tenta a assinatura
> recorrente e, se a loja recusar, cai automaticamente para o checkout PIX
> avulso do mesmo período. Nesse modo o acesso vale até o fim do período pago e
> a renovação é manual (a conta mostra "Renove para continuar"). Assim que o
> cartão/PIX Automático for habilitado no dashboard, a recorrência passa a
> funcionar sem mudança de código.

**Asaas (cartão recorrente):** além do AbacatePay (PIX), o cartão usa o
Checkout recorrente do Asaas. Configure no Render:

| Variável | Valor |
| --- | --- |
| `ASAAS_API_KEY` | chave de produção do Asaas (`$aact_prod_...`) |
| `ASAAS_API_URL` | `https://api.asaas.com` |
| `ASAAS_WEBHOOK_TOKEN` | token forte do webhook (header `asaas-access-token`) |

Webhook Asaas: `POST /billing/webhook/asaas`, criado no painel/API com os
eventos `CHECKOUT_PAID`, `CHECKOUT_CANCELED`, `CHECKOUT_EXPIRED`,
`SUBSCRIPTION_CREATED`, `SUBSCRIPTION_INACTIVATED`, `SUBSCRIPTION_DELETED`,
`PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE` e
`PAYMENT_CREDIT_CARD_CAPTURE_REFUSED`.

## 2.1 IA — diagnóstico de "não gera Content Kit"
- `GET /ready` informa a configuração da IA. Sem `GEMINI_API_KEY`, a geração
  usa um roteiro-base validado e responde com `fallback: true`. Defina a chave
  e reinicie para voltar à geração por IA.
- `GET /admin/ai-usage` (admin) mostra chamadas, tokens e erros; picos de
  `generateTokens` sem `generateCalls` indicam retry por timeout/saída inválida.
- Códigos no dialog: `SERVICE_UNAVAILABLE` (falha transitória — tentar de novo),
  `PLAN_LIMIT`/`CONFLICT` com mensagem de cota (Grátis: `FREE_SEARCHES_PER_WEEK`
  e `FREE_KITS_PER_WEEK` por semana; Pro: teto interno de 1.000 kits/mês e
  1.000 buscas/dia)
  ou cooldown `force_new` 30s. Com fallback ativo, a geração raramente erra.
- `GEMINI_MODEL` padrão `gemini-3.1-flash-lite`; se a Google desligar o modelo,
  a geração falha em todas as tentativas — troque a env, sem deploy de código.
- Com billing ativo, os limites vêm do plano (`PLAN_LIMITS` em
  `src/modules/billing/plans.ts`): Pro é ilimitado na tabela (kits, buscas,
  roteiros salvos e produção), com teto interno de uso justo
  (`FAIR_USE_KITS_PER_MONTH = 1000`) aplicado apenas no backend e nos Termos.
  Não há trial: o checkout cria a assinatura já cobrada (`trial_days: 0`).
  Sem billing, o Grátis mantém os limites gratuitos definidos em `plans.ts` e os
  planos pagos ficam sem o teto de uso justo; não existe estado "sem plano" que
  trave a geração.

## 3. Migrations Supabase
- `019_performance_indexes.sql`, `020_rls_hardening.sql` e `021_rls_content_kits_fix.sql`
  são aditivas (`IF NOT EXISTS` / drop+create de policy) e seguras.
  `021` remove a leitura ampla `content_kits_select_active` recriada em `020`
  e restaura kits privados por creator + `WITH CHECK` em `creators_update_own`.
- Gap `013–015`: arquivos TikTok antigos foram **removidos intencionalmente**
  (`012_tiktok_integration`, `013_tiktok_security_followup`,
  `014_rls_performance_hardening`, `015_tiktok_active_upload_idempotency`).
  O `012` atual é outro arquivo (`012_manual_publication_mvp.sql`).
- Se o banco de staging já aplicou os TikTok antigos: resete o staging ou
  marque como revertidas antes do push. Em banco novo, apenas `supabase db push`.
- Valide com `supabase db push --dry-run` antes da produção.
- `027_analytics_events`, `028_billing`, `029_support`,
  `031_pricing_launch_fair_use` e `032_launch_seats_distinct` **já estão
  aplicadas em produção** (verificado em 27/10/2026). RLS sem policies = acesso
  só pela API (service role).
  A `029` cria o canal de suporte (`support_tickets`/`support_messages` + RPC
  `analytics_funnel` restrita ao service role) e remove `creators.kits_extra`.
  A `031` adiciona `billing_mode`, `launch_price`, `launch_seat` e as RPCs
  `claim_launch_seat`/`launch_seats_used` (vagas de lançamento atômicas,
  liberadas ao cancelar/expirar). Detalhes em
  [`docs/go-live-billing.md`](../../docs/go-live-billing.md).

**Pendentes em 27/10/2026 (repositório até `035`):** o projeto Supabase
configurado no repositório tem histórico até `032` e não possui
`creator_content.scheduled_for` nem `ai_usage_daily.support_calls`. Aplique, nesta
ordem, antes do próximo deploy do backend:

- `033_import_fastmoss_product_searches_20261025.sql` — dados de catálogo.
- `034_creator_content_schedule.sql` — `scheduled_for`; sem ela o código grava a
  data em `notas` (fallback), mas o índice/coluna ficam ausentes.
- `035_support_ai_quota.sql` — **obrigatória** com `AI_QUOTA_STORE=database`:
  sem ela, `reserve_ai_quota(..., 'support')` levanta exceção e o chat de suporte
  responde 500.

Status detalhado em
[`backend/supabase/migrations/README.md`](../supabase/migrations/README.md).

## 4. Custo IA
- `GET /admin/ai-usage` (admin) mostra chamadas, tokens, cache hits e cotas.
- **Grátis:** 100 buscas/semana e 10 roteiros/semana (ambos renovam toda
  segunda, 00:00 de Brasília), contados em `ai_usage_daily`; a aba Produtos (catálogo)
  é bloqueada para o Grátis. **Pro:** 1.000 kits/mês (uso justo, interno) + guarda diária de
  1.000 kits; buscas têm guarda de 100/dia por usuário
  (`AI_QUOTA.ASSISTANT_PER_DAY`), sem aparecer na tabela de planos. `force_new`
  tem cooldown de 30s por produto. Ajuste em `src/lib/ai-metrics.ts` (`AI_QUOTA`).
- Rate-limit por minuto: assistant 10, kit 12 (o planejador semanal gera 7 em
  sequência), suporte 20 (com cota diária de 40 mensagens de IA).
- Geração nunca falha por IA: sem chave ou após 3 tentativas, salva um
  roteiro base honesto (`fallback: true` na resposta) com os dados reais.

## 5. Checklist manual (não automatizável aqui)
OAuth Google callback, email recovery real, upload Storage real,
teste físico mobile/tablet, carga Gemini real.

## 6. Controles distribuídos e sincronização
- Aplique as migrations até `045_quota_support_kind.sql` antes de publicar esta versão (ver `supabase/migrations/README.md`).
- `AI_QUOTA_STORE=database` mantém cotas e cooldowns atômicos no PostgreSQL.
- Configure `REDIS_URL` em ambientes com mais de uma instância para compartilhar o rate limit HTTP.
- Configure `CATALOG_FEED_URL` e, se necessário, `CATALOG_FEED_TOKEN`; agende `npm run catalog:sync` no provedor para atualizar o catálogo.
- `/ready` retorna 503 quando o banco não responde; use-o como readiness probe. `/health` continua sendo apenas liveness.
- Rode `npm run test:e2e` no frontend para os smoke tests do navegador
  (`$env:NEXT_PUBLIC_E2E=1` em dev; CI usa `retries: 2`).

## 7. Estado real de produção (13/11/2026)
- Backend: Render `temtrend-api` (`https://temtrend-api.onrender.com`), plano
  **free** (Starter pendente), deployado a partir de `main`. **Auto-deploy não
  dispara a cada push** — confira o histórico em Deploys; dispare manualmente ou
  reconecte o GitHub App.
- **O código em produção é anterior ao redesign atual** (limites 3/3, rotas
  `/app/*`, sem Asaas/links compartilhados). É preciso fazer um novo deploy.
- Rotas verificadas: `GET /health` e `GET /ready` 200; `GET /billing/plans`
  200 com `enabled: false` até as chaves de cobrança existirem.
- Frontend: `https://www.temtrend.com` (`/`, `/planos`, `/termos`, `/privacidade`,
  `/reembolso`, `/descobrir`, `/produtos`, `/producao`, `/conteudos`,
  `/calendario`, `/resultados`, `/conta`, `/conta/planos`, `/preferencias`,
  `/suporte`, `/admin`, `/compartilhar/[slug]`).
- Banco: migrations até `045` aplicadas no projeto verificado; o catálogo tem
  ~3,7 mil produtos ativos.
- Falta para o go-live: deploy do código atual, `ABACATEPAY_API_KEY`/`ASAAS_API_KEY`,
  `RESEND_API_KEY`/`EMAIL_FROM` e upgrade para Starter (guia completo em
  [`docs/go-live-billing.md`](../../docs/go-live-billing.md)).
