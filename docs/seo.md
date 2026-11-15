# SEO e nomes de páginas — TemTrend

**Atualizado em:** 13/11/2026

## 1. O que está indexável

Apenas as páginas públicas. A área logada é `noindex, nofollow, nocache` no layout `(platform)` e em cada rota.

| Rota | `<title>` | Indexação |
|---|---|---|
| `/` | TemTrend — Produtos e roteiros para o TikTok Shop | index, follow |
| `/planos` | Planos e preços \| TemTrend | index, follow |
| `/termos` | Termos de Uso \| TemTrend | index, follow |
| `/privacidade` | Política de Privacidade \| TemTrend | index, follow |
| `/reembolso` | Política de Reembolso \| TemTrend | index, follow |
| `/descobrir` | Descobrir produtos \| TemTrend | noindex |
| `/conta` | Minha conta \| TemTrend | noindex |
| `/conta/planos` | Planos e assinatura \| TemTrend | noindex |
| `/conteudos` | Meus conteúdos \| TemTrend | noindex |
| `/producao` | Minha produção \| TemTrend | noindex |
| `/calendario` | Calendário editorial \| TemTrend | noindex |
| `/produtos` | Catálogo de produtos \| TemTrend | noindex |
| `/produtos/[id]` | Detalhes do produto \| TemTrend | noindex |
| `/produtos/[id]/kits/[kit]` | Plano de gravação \| TemTrend | noindex |
| `/descobrir/[sessão]` | Conversa do Descobrir \| TemTrend | noindex |
| `/compartilhar/[slug]` | Conversa compartilhada \| TemTrend | noindex |
| `/resultados` | Resultados \| TemTrend | noindex |
| `/preferencias` | Preferências \| TemTrend | noindex |
| `/suporte` | Suporte \| TemTrend | noindex |
| `/admin` | Administração \| TemTrend | noindex |

## 2. Como foi implementado

- `frontend/lib/seo.ts` — helper `pageMetadata()` com título, descrição, canonical, Open Graph e Twitter Card.
- `frontend/app/layout.tsx` — `metadataBase`, template de título, descrição padrão, keywords, `appleWebApp` e manifest.
- `frontend/app/(platform)/*/layout.tsx` — título e descrição de cada tela logada (com `noindex`).
- `frontend/app/robots.ts` — permite o público e bloqueia a área logada.
- `frontend/app/sitemap.ts` — apenas `/`, `/planos`, `/termos`, `/privacidade` e `/reembolso`.
- `frontend/app/manifest.ts` — nome curto, ícones, tema e `start_url`.
- `frontend/app/opengraph-image.tsx` — imagem 1200×630 gerada no build.
- `frontend/app/page.tsx` — JSON-LD com `Organization`, `WebSite`, `SoftwareApplication` e `FAQPage`.
- `frontend/next.config.ts` — redirect permanente de `/app/*` para as rotas atuais.

## 3. Regras para novas páginas

1. Página pública: use `pageMetadata({ title, description, path })`.
2. Página logada: use `pageMetadata({ ..., noindex: true })`.
3. Título sem a marca; o template do layout raiz adiciona `| TemTrend`.
4. Em layout aninhado (pai já tem título), use `absoluteTitle: true` e inclua a marca no título.
5. Sempre defina `path` canônico começando por `/`.
6. Não indexe telas com dados de conta, produto ou conversa.
7. Rode `npm run build` e confira `view-source` de cada rota alterada.

## 4. Verificação rápida

```bash
cd frontend
npm run build
npm run start -- --port 3000
# confira /robots.txt, /sitemap.xml, /manifest.webmanifest e o <title> de cada rota
```
