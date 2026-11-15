# TemTrend

Monorepo do MVP TemTrend.

- `frontend/`: Next.js 16 e React 19.
- `backend/`: Fastify, Gemini e Supabase.
- `backend/supabase/migrations/`: schema canônico do PostgreSQL (migrations até `035_support_ai_quota`; status real de aplicação em `backend/supabase/migrations/README.md`).

## O que a plataforma tem hoje

- **Assistente de IA** para escolher produtos, montar plano de gravação, roteiro, produção e publicação (TikTok Shop). A publicação é **manual**: o creator grava por fora e cola o link.
- **Billing e Planos**:
  - **Plano Pro (único pago)**: R$ 49,90/mês ou R$ 499/ano. A antiga condição de lançamento (R$ 39,90/399) está encerrada para novas contratações e permanece só nas renovações de quem já assinou nela. Kits e buscas **ilimitados** (sem cotas diárias; política interna de uso justo de 1.000 kits/mês contra automação).
  - **Plano Grátis**: 100 buscas por semana e 10 roteiros por semana, ambos renovando toda segunda-feira. A aba Produtos (catálogo completo) é exclusiva do Pro.
  - **Enterprise**: condições sob consulta.
  - *(Planos legados Essencial e Scale foram descontinuados para novas assinaturas e permanecem no código só por compatibilidade com assinaturas antigas.)*
  - Checkout **PIX** (AbacatePay) e **cartão recorrente** (Asaas), cancelamento e webhooks idempotentes, atrás da flag `BILLING_ENABLED`.
- **Jornada do creator**: landing → cadastro com código de e-mail (ou Google) → onboarding → descobrir → produto → roteiro (kit em 8 partes) → gravação guiada → conteúdos → calendário editorial → conta.
- **Sessão persistida** no navegador (`persistSession: true`), com refresh automático: recarregar a página não desloga.
- **Links compartilháveis** de conversas do Descobrir (`/compartilhar/[slug]`), com importação do roteiro para quem recebe.
- **Canal de suporte in-platform** (`/suporte`) conectado ao painel admin (fila + resposta), com assistente de IA próprio.
- **Painel admin** (`/admin`) com catálogo, creators, assinaturas, suporte, uso de IA e funil de eventos 30d.
- **Analytics de funil** (`analytics_events` + `POST /events`) e catálogo sincronizado do FastMoss.

## Rotas da plataforma

`/descobrir`, `/produtos`, `/produtos/[productId]`, `/produtos/[productId]/kits/[kitId]`, `/producao`, `/conteudos`, `/calendario`, `/resultados`, `/conta`, `/conta/planos`, `/preferencias`, `/suporte`, `/admin` e `/compartilhar/[slug]`.
Links antigos em `/app/*` redirecionam em definitivo para a rota equivalente.

## Validação local

```bash
npm run verify
cd frontend && npm run test:e2e
```

## Produção

Frontend (`https://www.temtrend.com`) e backend (`temtrend-api.onrender.com`) implantados separadamente.

O repositório tem migrations até `045`. A verificação de 13/11/2026 no projeto Supabase configurado encontrou o schema necessário ao código atual (`scheduled_for`, `support_calls`, `shared_conversations`, cota semanal e suporte) aplicado. O catálogo tem ~3,7 mil produtos ativos. Os detalhes e o histórico de aplicação estão em `backend/supabase/migrations/README.md`.

Checklist de go-live da cobrança e smoke test atual em `docs/go-live-billing.md`. Inventário funcional em `docs/inventario-funcional.md`. Mapa da jornada e das telas em `docs/mapa-plataforma.md`. SEO, títulos e indexação em `docs/seo.md`. Runbook de operação (saúde, pagamentos, retenção, IA e incidentes) em `docs/operacoes.md`. Revisão de lançamento e pendências em `docs/revisao-lancamento.md`.
