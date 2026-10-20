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

**Billing (em 20/10/2026):** `BILLING_ENABLED=true`, `ABACATEPAY_WEBHOOK_SECRET`
e `FRONTEND_URL` **já definidas no Render**; falta a **`ABACATEPAY_API_KEY`**
(segredo do dono — enquanto não existir, `billingActive()` fica `false` e o app
roda em modo legado, sem trial nem checkout). Webhook v2 criado
(`webh_prod_xS6hzaujufu2sQxkpYpAZ434`). Passo a passo em
[`docs/go-live-billing.md`](../../docs/go-live-billing.md).

## 2.1 IA — diagnóstico de "não gera Content Kit"
- `GET /ready` informa a configuração da IA. Sem `GEMINI_API_KEY`, a geração
  usa um roteiro-base validado e responde com `fallback: true`. Defina a chave
  e reinicie para voltar à geração por IA.
- `GET /admin/ai-usage` (admin) mostra chamadas, tokens e erros; picos de
  `generateTokens` sem `generateCalls` indicam retry por timeout/saída inválida.
- Códigos no dialog: `SERVICE_UNAVAILABLE` (falha transitória — tentar de novo),
  `CONFLICT` com mensagem de cota diária (`100 buscas / 30 roteiros`) ou
  cooldown `force_new` 30s. Com fallback ativo, a geração raramente erra.
- `GEMINI_MODEL` padrão `gemini-3.1-flash-lite`; se a Google desligar o modelo,
  a geração falha em todas as tentativas — troque a env, sem deploy de código.
- Com billing ativo, os limites vêm do plano (`PLAN_LIMITS` em
  `src/modules/billing/plans.ts`: essencial 50/dia · 30 kits/mês, pro 200/100,
  scale 500/300, enterprise ilimitado/1000); sem billing, valem as cotas
  globais abaixo. Estado "sem plano" (sem assinatura pós-trial) trava geração.

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
- `027_analytics_events`, `028_billing` e `029_support` **já estão aplicadas em
  produção** (18/10/2026). RLS sem policies = acesso só pela API (service role).
  A `029` cria o canal de suporte (`support_tickets`/`support_messages` + RPC
  `analytics_funnel` restrita ao service role) e remove `creators.kits_extra`.
  Detalhes em [`docs/go-live-billing.md`](../../docs/go-live-billing.md).

## 4. Custo IA
- `GET /admin/ai-usage` (admin) mostra chamadas, tokens, cache hits e cotas.
- Cotas diárias MVP: 100 buscas + 30 roteiros por usuário; `force_new` com
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
