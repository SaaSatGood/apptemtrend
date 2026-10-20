# TemTrend

Monorepo do MVP TemTrend.

- `frontend/`: Next.js 16 e React 19.
- `backend/`: Fastify, Gemini e Supabase.
- `backend/supabase/migrations/`: schema canônico do PostgreSQL (até `029_support`, todas aplicadas em produção em 18/10/2026).

## O que a plataforma tem hoje

- **Assistente de IA** para escolher produtos, montar plano de gravação, roteiro, produção e publicação (TikTok Shop).
- **Billing assinatura (AbacatePay)**: planos Essencial/Pro/Scale/Enterprise, trial Pro de 7 dias sem cartão, mensal/anual, troca agendada, cancelamento e webhook idempotente. Atrás da flag `BILLING_ENABLED` + `ABACATEPAY_API_KEY` — enquanto a chave não estiver no Render, o app roda em modo legado (inofensivo).
- **Canal de suporte in-platform** (`/app/suporte`) conectado ao painel admin (fila + resposta).
- **Painel admin** com assinaturas, suporte e funil de eventos 30d.
- **Analytics de funil** (`analytics_events` + `POST /events`) e catálogo sincronizado do FastMoss.

## Validação local

```bash
npm run verify
cd frontend && npm run test:e2e
```

## Produção

Frontend (temtrend.online) e backend (`temtrend-api.onrender.com`) implantados separadamente; migrations até `029_support` já aplicadas em produção. Checklist de go-live da cobrança e o smoke test atual em `docs/go-live-billing.md` (os **dois passos restantes são humanos**: `ABACATEPAY_API_KEY` no Render + upgrade para Starter).
