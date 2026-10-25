# TemTrend — Deploy MVP (checklist)

## 1. Frontend (`frontend`)
O app atual é o Next.js na raiz dessa pasta. A versão estática anterior foi
preservada em `frontend/legacy-static` apenas para referência e testes legados.

### Configuração do frontend legado
Ordem de configuração da API:
1. `window.TEMTREND_CONFIG.API_URL` via `config.js` (copie `config.example.js` → `config.js`, **não commitar**).
2. `localStorage temtrend_api_url`.
3. `meta[name="temtrend-api-url"]` em `app.html`.
4. `http://localhost:3333` se hostname for localhost.

Em produção, preencha **um** dos três primeiros. Sem isso o app mostra
"Serviço indisponível" em vez de quebrar silenciosamente.

## 2. Backend (`backend`) — deployado no Render (`temtrend-api`)
Env obrigatórias: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PORT`,
`NODE_ENV=production`, `CORS_ORIGIN` (separadas por vírgula, sem espaço extra —
o código faz trim), `FRONTEND_URL` (`https://temtrend.online`), `GEMINI_API_KEY`
(opcional; sem ela o assistant usa fallback local e a geração retorna 503
amigável), `GEMINI_MODEL`.

**Billing (em 24/10/2026):** `BILLING_ENABLED=true`, `ABACATEPAY_WEBHOOK_SECRET`
e `FRONTEND_URL` **já definidas no Render**; falta a **`ABACATEPAY_API_KEY`**
(segredo do dono — enquanto não existir, `billingActive()` fica `false` e o app
roda em modo legado, sem trial nem checkout). Webhook v2 criado
(`webh_prod_xS6hzaujufu2sQxkpYpAZ434`). Passo a passo em
[`docs/go-live-billing.md`](../../docs/go-live-billing.md).

**Catálogo público:** um único plano pago, `pro` (R$ 49,90/mês ou R$ 499/ano),
com condição de lançamento para os primeiros 100 clientes (R$ 39,90/mês ou
R$ 399/ano, mantida enquanto a assinatura estiver ativa). `enterprise` aparece
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

## 2.1 IA — diagnóstico de "não gera Content Kit"
- `GET /ready` informa a configuração da IA. Sem `GEMINI_API_KEY`, a geração
  usa um roteiro-base validado e responde com `fallback: true`. Defina a chave
  e reinicie para voltar à geração por IA.
- `GET /admin/ai-usage` (admin) mostra chamadas, tokens e erros; picos de
  `generateTokens` sem `generateCalls` indicam retry por timeout/saída inválida.
- Códigos no dialog: `SERVICE_UNAVAILABLE` (falha transitória — tentar de novo),
  `CONFLICT` com mensagem de cota (100 buscas/dia; 30 roteiros/dia apenas no
  modo legado/sem plano) ou cooldown `force_new` 30s. Com fallback ativo, a
  geração raramente erra.
- `GEMINI_MODEL` padrão `gemini-3.1-flash-lite`; se a Google desligar o modelo,
  a geração falha em todas as tentativas — troque a env, sem deploy de código.
- Com billing ativo, os limites vêm do plano (`PLAN_LIMITS` em
  `src/modules/billing/plans.ts`): Pro é ilimitado na tabela (kits, buscas,
  roteiros salvos e produção), com teto interno de uso justo
  (`FAIR_USE_KITS_PER_MONTH = 1000`) aplicado apenas no backend e nos Termos.
  O trial de Pro tem trava interna adicional de 100 kits. Sem billing, valem as
  cotas globais abaixo. Estado "sem plano" (sem assinatura pós-trial) trava a
  geração.

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
- `027_analytics_events`, `028_billing`, `029_support` e
  `031_pricing_launch_fair_use` **já estão aplicadas em produção**
  (24/10/2026). RLS sem policies = acesso só pela API (service role).
  A `029` cria o canal de suporte (`support_tickets`/`support_messages` + RPC
  `analytics_funnel` restrita ao service role) e remove `creators.kits_extra`.
  A `031` adiciona `billing_mode`, `launch_price`, `launch_seat` e as RPCs
  `claim_launch_seat`/`launch_seats_used` (vagas de lançamento atômicas,
  liberadas ao cancelar/expirar). Detalhes em
  [`docs/go-live-billing.md`](../../docs/go-live-billing.md).

## 4. Custo IA
- `GET /admin/ai-usage` (admin) mostra chamadas, tokens, cache hits e cotas.
- Cotas do modo legado/sem plano: 100 buscas + 30 roteiros por usuário/dia.
  Com billing ativo, Pro usa uso justo mensal de 1.000 kits (trial: 100) e a
  guarda diária de 100 buscas continua, sem exibir o número. `force_new` tem
  cooldown de 30s por produto. Ajuste em `src/lib/ai-metrics.ts` (`AI_QUOTA`).
- Rate-limit por minuto: assistant 10, kit 5.
- Geração nunca falha por IA: sem chave ou após 3 tentativas, salva um
  roteiro base honesto (`fallback: true` na resposta) com os dados reais.

## 5. Checklist manual (não automatizável aqui)
OAuth Google callback, email recovery real, upload Storage real,
teste físico mobile/tablet, carga Gemini real.

## 6. Controles distribuídos e sincronização
- Aplique `022_persistent_ai_controls.sql` antes de publicar esta versão.
- `AI_QUOTA_STORE=database` mantém cotas e cooldowns atômicos no PostgreSQL.
- Configure `REDIS_URL` em ambientes com mais de uma instância para compartilhar o rate limit HTTP.
- Configure `CATALOG_FEED_URL` e, se necessário, `CATALOG_FEED_TOKEN`; agende `npm run catalog:sync` no provedor para atualizar o catálogo.
- `/ready` retorna 503 quando o banco não responde; use-o como readiness probe. `/health` continua sendo apenas liveness.
- Rode `npm run test:e2e` no frontend para os smoke tests do navegador
  (`$env:NEXT_PUBLIC_E2E=1` em dev; CI usa `retries: 2`).

## 7. Estado real de produção (20/10/2026)
- Backend: Render `temtrend-api` (`https://temtrend-api.onrender.com`), plano
  **free** (Starter pendente), última versão live = commit `cd5c7ce` ou
  posterior. **Auto-deploy não dispara a cada push** — todos os deploys têm
  `trigger: api`; dispare manualmente ou reconecte o GitHub App.
- Rotas novas verificadas em produção: `GET /billing/plans` 200, `GET /health`
  200, webhook/support/admin 401 sem auth, `POST /events` 400 sem corpo.
- Frontend: `https://temtrend.online` (`/planos`, `/app/suporte` no ar).
- Falta para o go-live da cobrança: `ABACATEPAY_API_KEY` no Render +
  upgrade para Starter (guia completo em
  [`docs/go-live-billing.md`](../../docs/go-live-billing.md)).
