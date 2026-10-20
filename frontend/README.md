# TemTrend Web (Next.js)

Frontend principal em Next.js App Router. O front estático anterior foi preservado em
`legacy-static/`, sem alterar os contratos com a API em `../backend/`.

## Rotas

- `/` — landing (hero editorial, prova social honesta, FAQ)
- `/planos` — página pública de planos (catálogo vem da API com fallback; sem plano grátis e sem compra avulsa)
- `/app` — plataforma (login, cadastro, recovery, onboarding, descoberta, produto,
  Content Kit, produção, conta, suporte, admin). `?mode=signup` abre o cadastro.
- `/termos`, `/privacidade` — páginas legais mínimas (LGPD).
- `/emconstrucao` — página de funcionalidade futura.

## Configuração

Copie `.env.example` para `.env.local` e preencha:

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_URL` — endereço do backend (ex.: `http://localhost:3333`).
  Em runtime o browser ainda aceita `localStorage temtrend_api_url`.

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
   - `NEXT_PUBLIC_API_URL` — URL pública do backend (ex.: `https://api.seudominio.com`).
4. No Supabase Auth → URL Configuration, cadastre o domínio da Vercel em
   Site URL e Redirect URLs (login Google e recovery redirecionam para
   `window.location.origin + pathname`).
5. Rotas próprias, sem hash: `/app`, `/app/producao`, `/app/produtos/[id]`,
   `/app/produtos/[productId]/kits/[kitId]`, `/app/conta`, `/app/admin`.

## Estrutura

- `app/` — `layout.tsx` (fontes + CSS global; `canonical.css` por último = fonte
  única dos tokens), `page.tsx` (landing), `planos/`, `app/page.tsx`
  (plataforma), `app/suporte/page.tsx`, `termos/`, `privacidade/`,
  `emconstrucao/`.
- `components/platform/` — `store.tsx` (sessão persistida, perfil, produção, toasts),
  `Auth`, `Onboarding` (trial Pro 7d quando billing ativo), `Assistant`,
  `ProductKit`, `KitDetail`, `Production`, `Account` (card de plano real),
  `PlanBanner` (faixa: trial, trial encerrado, past_due, cancelada com acesso),
  `UpgradeDialog`, `Support` (canal de suporte), `ApiWarmup`, `TrackView`,
  `Admin` (visão geral, Catálogo+IA, Assinaturas, Suporte).
- `components/pricing/PricingPage.tsx` — `/planos`.
- `lib/` — `config`, `supabase` (`persistSession: true`), `api` (Bearer JWT +
  `code` do erro), `format`, `track` (analytics de funil), `support`, `types`.
- `styles/` — `canonical.css` (tokens/contratos, é importado por último),
  `design-system.css`, `platform-*`, `pricing.css`, `support.css`.
- `tests/e2e/` — Playwright, com mocks de API (rode com `$env:NEXT_PUBLIC_E2E=1`; CI usa `retries: 2`). Cobre landing pública, onboarding/jornada, admin (incl. Assinaturas e Suporte), `/planos` e suporte.
- `legacy-static/` — implementação anterior, preservada para referência e testes legados.

## Regras preservadas do front antigo

- Auth Supabase no browser; senha nunca vai para a API; sessão persistida.
- Onboarding obrigatório com rascunho em `localStorage` + restauração.
- Pipeline `salvo → em_producao → gravado → publicado` validado no backend.
- `force_new` com cooldown, cotas e `fallback: true` tratados com toasts dedicados.
- Nenhum vídeo é armazenado ou publicado automaticamente.

## Barras de plano (billing)

- `PlanBanner.tsx` cobre 4 estados: trialing, trial encerrado ("sem plano",
  travado), past_due e cancelada com acesso até o fim do período.
- Limites exibidos no card da conta vêm de `/me`; quando o billing está
  desativado (`enabled: false` em `GET /billing/plans`), a conta usa as cotas
  globais antigas (100 buscas/dia + 30 kits/dia).
