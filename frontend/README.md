# TemTrend Web (Next.js)

Frontend principal em Next.js App Router. O front estático anterior foi preservado em
`legacy-static/`, sem alterar os contratos com a API em `../backend/`.

## Rotas

- `/` — landing (igual à anterior, com menu mobile e FAQ)
- `/app` — plataforma (login, cadastro, recovery, onboarding, descoberta, produto,
  Content Kit, produção, conta, admin). `?mode=signup` abre o cadastro.
- `/termos`, `/privacidade` — páginas legais mínimas (LGPD).

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

- `app/` — `layout.tsx` (fontes + CSS global portado do frontend legado),
  `page.tsx` (landing), `app/page.tsx` (plataforma), `termos/`, `privacidade/`.
- `components/platform/` — `store.tsx` (sessão, perfil, produção, toasts),
  `Auth`, `Onboarding`, `Assistant`, `ProductKit` (produto + documento do kit),
  `KitDetail`, `Production`, `Account`, `Admin`, `ContentKitDialog`.
- `lib/` — `config`, `supabase`, `api` (Bearer JWT + `code` do erro),
  `format` (nome de exibição, datas, TikTok, clipboard, cenas), `types`.
- `styles/` — CSS original copiado sem redesign.
- `legacy-static/` — implementação anterior, preservada para referência e testes legados.

## Regras preservadas do front antigo

- Auth Supabase no browser; senha nunca vai para a API.
- Onboarding obrigatório com rascunho em `localStorage`.
- Pipeline `salvo → em_producao → gravado → publicado` validado no backend.
- `force_new` com cooldown, cotas e `fallback: true` tratados com toasts dedicados.
- Nenhum vídeo é armazenado ou publicado automaticamente.
