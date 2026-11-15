# TemTrend Web (Next.js)

Frontend principal em Next.js App Router. É o único front do repositório: a versão
estática anterior (`legacy-static/`) foi removida. Os contratos com a API ficam em
`../backend/`.

## Rotas

- `/` — landing (hero editorial, busca, exemplos, 8 partes do plano, planos, FAQ e rodapé legal)
- `/planos` — página pública de planos (catálogo da API com fallback; Pro a R$ 49,90/mês ou R$ 499/ano, Enterprise sob consulta; checkout com Cartão recorrente ou PIX por período; condição antiga de lançamento mantida só em renovações; sem planos legados Essencial/Scale e sem compra avulsa)
- `/conta/planos` — planos e assinatura dentro do dashboard (plano atual, troca de ciclo, renovação e checkout, sem sair da plataforma)
- `/termos`, `/privacidade`, `/reembolso` — páginas legais completas (LGPD/CDC)
- `/descobrir` — entrada da plataforma (login, cadastro com código, recuperação e redefinição de senha). `?mode=signup` abre o cadastro. Com sessão, renderiza a busca conversacional, filtros, histórico e planejador semanal
- `/produtos/[productId]` — produto, comissão/vendas e roteiros salvos
- `/produtos/[productId]/kits/[kitId]` — plano de gravação em 8 partes + modo guiado
- `/producao` — funil `salvo → em produção → gravado → publicado`, com link manual do TikTok
- `/conteudos` — biblioteca de roteiros, filtros, cópia de gancho e agendamento
- `/calendario` — calendário mensal editorial (a data é planejada; não publica sozinho)
- `/conta` — perfil, senha, preferências, voz, plano, cancelamento e exclusão
- `/suporte` — assistente de suporte com IA + conversas com o time
- `/admin` — visão geral, catálogo, creators, assinaturas, suporte, IA e funil

## Configuração

Copie `.env.example` para `.env.local` e preencha:

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (ou o nome novo
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)
- `NEXT_PUBLIC_API_URL` — endereço do backend (ex.: `http://localhost:3333`).
  Em runtime o browser ainda aceita `localStorage temtrend_api_url`.
- `NEXT_PUBLIC_SITE_URL` — URL pública do site (canonical, sitemap e Open Graph).
  Em produção: `https://www.temtrend.com`.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # valida tsc + build de produção
```

## Deploy na Vercel

1. Importe o repositório e defina **Root Directory** como `frontend`.
2. Framework: Next.js (detectado automaticamente). Build: `npm run build`.
3. Variáveis de ambiente (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_API_URL` — URL pública do backend (ex.: `https://temtrend-api.onrender.com`).
   - `NEXT_PUBLIC_SITE_URL` — `https://www.temtrend.com`.
4. No Supabase Auth → URL Configuration, cadastre o domínio da Vercel em
   Site URL e Redirect URLs (login Google e recovery redirecionam para
   `window.location.origin + pathname`).
5. Rotas próprias, sem hash: `/descobrir`, `/produtos`, `/producao`,
   `/conteudos`, `/calendario`, `/resultados`, `/produtos/[productId]`,
   `/produtos/[productId]/kits/[kitId]`, `/conta`, `/conta/planos`,
   `/preferencias`, `/suporte`, `/admin` e `/compartilhar/[slug]`.

## SEO

- `lib/seo.ts` centraliza título, descrição, canonical, Open Graph e Twitter Card.
- Cada rota tem seu próprio título; a área logada é `noindex`.
- `app/robots.ts`, `app/sitemap.ts`, `app/manifest.ts` e `app/opengraph-image.tsx` são gerados no build.
- Regras e tabela de títulos em `docs/seo.md`.

## Estrutura

- `app/` — `layout.tsx` (fontes + CSS global; `canonical.css` por último = fonte
  única dos tokens), `page.tsx` (landing), `landing-*.tsx` (seções da landing),
  `planos/`, `(platform)/layout.tsx` + `(platform)/*/page.tsx` (descobrir,
  produtos, kits, produção, conteúdos, calendário, resultados, conta,
  preferências, suporte, admin e compartilhar), `termos/`, `privacidade/`,
  `reembolso/`, `robots.ts`, `sitemap.ts` e `opengraph-image.tsx`.
- `components/platform/` — `store.tsx` (sessão persistida no navegador, perfil, produção, toasts),
  `Auth`, `Onboarding` (5 etapas; sem trial), `Assistant`, `Dashboard`,
  `ProductKit`, `KitDetail`, `GuidedKit`, `Production`, `ContentsView`,
  `CalendarView`, `WeeklyPlanner`, `Account` (card de plano real),
  `PlanBanner` (past_due e cancelada com acesso), `UpgradeDialog`, `Support`,
  `SupportChat`, `NotificationCenter`, `Admin` (visão geral, Catálogo+IA,
  Assinaturas, Suporte), `AppShell`/`AppSidebar`/`Topbar`.
- `components/` (raiz) — `PublicNav`, `PublicFooter`, `ApiWarmup`, `TrackView`.
- `components/pricing/PricingPage.tsx` — `/planos`.
- `components/legal/LegalPageFrame.tsx` — moldura das páginas legais.
- `lib/` — `config`, `supabase` (`persistSession: true`), `api` (Bearer JWT +
  `code` do erro), `billing-catalog`, `plan-display`, `format`, `track`
  (analytics de funil), `support`, `types`.
- `styles/` — `canonical.css` (tokens/contratos, é importado por último),
  `design-system.css`, `platform-*`, `pricing.css`, `support.css`.
- `tests/e2e/` — Playwright com mocks de API (`public-flow`, `pricing`,
  `creator-journey`, `admin`, `support`, `weekly-planner`; rode com
  `$env:NEXT_PUBLIC_E2E=1`; CI usa `retries: 2`).

## Regras preservadas do front antigo

- Auth Supabase no browser; senha nunca vai para a API; sessão persistida no navegador com refresh automático (logout só explícito ou expiração).
- Onboarding obrigatório com rascunho em `localStorage` + restauração.
- Pipeline `salvo → em_producao → gravado → publicado` validado no backend.
- `force_new` com cooldown, cotas e `fallback: true` tratados com toasts dedicados.
- Nenhum vídeo é armazenado ou publicado automaticamente. O calendário é editorial.

## Barras de plano e cotas (billing)

- `PlanBanner.tsx` cobre estados contextuais da assinatura: `past_due` (pagamento
  pendente, acesso liberado enquanto o provedor tenta de novo) e `canceled`
  (acesso até o fim do período pago). **Não existe estado de trial.**
- **Modelo de cotas atual:**
  - **Plano Grátis:** 100 buscas por semana (reset toda segunda) e 10
    roteiros por semana (reset toda segunda). Os limites vêm do backend
    (`/billing/plans`). A aba **Produtos** (catálogo
    completo) é exclusiva do Pro; a busca do Descobrir e a gravação dos
    conteúdos liberados continuam funcionando.
  - **Plano Pro:** ilimitado — o creator cria kits e faz buscas sem contagem
    regressiva de cotas diárias. O backend aplica apenas tetos internos de uso
    justo contra automação (`FAIR_USE_KITS_PER_MONTH = 1000` e
    `FAIR_USE_SEARCHES_PER_DAY = 1000`), que não aparecem como cota de plano.
  - Planos antigos (Essencial e Scale) e cobranças avulsas foram descontinuados
    para novas adesões.
- O billing fica atrás de `BILLING_ENABLED`. Sem `ABACATEPAY_API_KEY` (PIX) nem
  `ASAAS_API_KEY` (cartão), o checkout não é criado, mas os limites do Grátis
  continuam valendo.
- O cadastro por e-mail depende de `RESEND_API_KEY` e `EMAIL_FROM` no backend;
  sem eles, a rota `/auth/signup` responde 503 e desfaz a conta.
