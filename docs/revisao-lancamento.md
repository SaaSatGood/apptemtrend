# Revisão de lançamento — TemTrend

**Data:** 13/11/2026
**Escopo:** auditoria completa do monorepo (jornada, backend, banco, segurança/LGPD, pagamentos, IA, analytics, UX, testes/CI e operação) e correções aplicadas.
**Estado:** código, banco e testes prontos. O lançamento depende apenas de **deploy coordenado e chaves de produção** (seção 4).

## 1. O que foi corrigido nesta revisão

### Banco de dados
- Aplicadas no projeto Supabase verificado as migrations que faltavam:
  - `034_creator_content_schedule` — `creator_content.scheduled_for`;
  - `036_shared_conversations` — links compartilháveis + `content_kits.source_kit_id`;
  - `035_support_ai_quota` — `ai_usage_daily.support_calls`;
  - `045_quota_support_kind` (**nova**) — corrige `reserve_ai_quota_on`/`release_ai_quota_on` para aceitar `p_kind='support'`.
- Catálogo confirmado com ~3,7 mil produtos ativos.

### Backend / produto
- **Cota do suporte:** o chat de suporte com IA respondia 500 porque a migration `043` removeu o contador `support`. Corrigido com a `045` e coberto por teste de definição de função.
- **Paywall do catálogo:** `GET /products` passou a exigir plano pago (`assertCatalogAccess`), fechando o contorno por API.
- **Cota de roteiros:** `POST /creator-content` agora consome a cota semanal/mensal ao gerar um kit, mas **reutiliza** um roteiro já existente sem cobrar de novo.
- **Busca "ilimitada" do Pro:** o teto escondido de 100/dia virou uso justo de 1.000/dia (`FAIR_USE_SEARCHES_PER_DAY`) e a mensagem deixou de dizer que "acabaram as buscas do dia".
- **Webhook Asaas:** removido o fallback perigoso que ativava a assinatura pendente mais recente de qualquer creator quando não havia vínculo. Sem `externalReference`/`subscription`/`checkout`, o evento é ignorado e logado.
- **Métricas de IA:** tokens de tentativas descartadas pelos guardrails agora são contabilizados; `userId` passou a ser enviado na classificação; briefing de 1.500 caracteres não é mais truncado em 400.
- **Alertas:** `ALERT_WEBHOOK_URL` opcional envia erro 5xx para Slack/Discord sem dados pessoais.
- **CORS local:** aceita `127.0.0.1:3000` além de `localhost:3000`.

### Frontend / UX
- **Prova social inventada removida:** depoimentos ilustrativos e a barra falsa de "vagas de lançamento" saíram da landing, de `/planos` e do dashboard. A landing não promete mais "vídeos que vendem" nem "teleprompter".
- **Sessão:** documentação e UI alinhadas à sessão persistida (`persistSession: true`).
- **Voz personalizada:** no Grátis o campo fica bloqueado com CTA para o Pro, em vez de aceitar texto que a IA ignorava.
- **Conta:** removida a mensagem "Assinaturas abrem em breve" para contas Grátis; agora convida ao Pro.
- **Comparação de produtos:** o botão "Comparar" voltou a ser renderizado (o CSS existia, o JSX não).
- **Títulos/SEO:** `metadataBase`, Open Graph, `robots.txt`, `sitemap.xml`, imagem OG gerada no build e `noindex` na área logada.
- **Rotas antigas:** `/app/*` redireciona em definitivo para as rotas atuais.
- **Cold start:** primeiro `/me` espera até 45 s e a casca mostra "Preparando sua conta…" em vez de tela vazia.
- **Analytics:** incluídos `paywall_view`, `onboarding_skipped` e `results_waitlist_click` na lista fechada do backend; promessa falsa de "avisamos você" em Resultados substituída por "interesse registrado".
- **Landing:** contador de partes corrigido para 8; URL de exemplo corrigida para `www.temtrend.com`; "Suporte por email" trocado por "Suporte interno na plataforma".

### Documentação e higiene
- Atualizados `README.md`, `frontend/README.md`, `backend/docs/DEPLOY.md`, `DESIGN.md`, `docs/inventario-funcional.md`, `docs/go-live-billing.md`, `docs/relatorio-precificacao.md` e `backend/supabase/migrations/README.md`.
- Novo runbook: `docs/operacoes.md` (saúde, pagamentos, reconciliação, retenção, IA e incidentes).
- Removidos artefatos de desenvolvimento (`e2e-output.txt`, `grid-block.txt`, `.tmp-color.mjs`).

## 1.1 Segunda revisão — SEO, títulos e navegação (13/11/2026)

- Criado `frontend/lib/seo.ts` e aplicado `pageMetadata()` nas páginas públicas e em todas as telas logadas.
- Corrigidos os nomes/títulos das páginas, inclusive o sufixo `| TemTrend` em layouts aninhados (`/conta/planos`, produto, kit e sessão do Descobrir).
- Adicionados canonical, Open Graph e Twitter Card por página.
- Criados `robots.ts`, `sitemap.ts`, `manifest.ts`, `opengraph-image.tsx` e JSON-LD (`Organization`, `WebSite`, `SoftwareApplication`, `FAQPage`).
- A área logada passou a responder `noindex, nofollow, nocache`.
- Rotas `/app/*` seguem redirecionando com `308`.
- Corrigida a navegação órfã: **Calendário** e **Produção** agora aparecem na sidebar e no cabeçalho de Meus conteúdos.
- Documentação: `docs/seo.md` e `docs/mapa-plataforma.md`.

## 2. Verificações executadas

| Verificação | Resultado |
|---|---|
| Backend `tsc --noEmit` | ✅ |
| Backend `vitest run` | ✅ 28 arquivos / **258 testes** |
| Backend build (`tsc`) | ✅ |
| Frontend `eslint` | ✅ sem erros/avisos |
| Frontend `next build` | ✅ 24 rotas |
| Playwright E2E | ✅ **84 testes / 7 arquivos** |
| `npm audit --omit=dev` (front e back) | ✅ 0 vulnerabilidades |

## 3. Riscos conhecidos (não bloqueiam o código)

- **Pagamentos:** o Asaas não tem reconciliação automática; falhas são logadas e alertadas. O runbook descreve o reprocessamento manual.
- **Retenção de dados:** não há job automático de purge; o runbook traz as consultas sugeridas.
- **IA:** o custo é contabilizado por tentativa, mas não há alerta automático de gasto; o teto de uso justo é a proteção.
- **Admin:** a métrica de trial foi removida da interface; o campo legado continua no banco por compatibilidade.

## 4. Pendências humanas para o go-live

1. **Deploy do backend primeiro** (Render `temtrend-api`) — produção ainda roda o build anterior.
2. **Deploy do frontend depois** — o projeto de produção é o Vercel **`apptemtrend`** (Root Directory `frontend`), não o projeto `temtrend`.
3. **Chaves no Render:** `ABACATEPAY_API_KEY` (PIX) e/ou `ASAAS_API_KEY` (cartão); `RESEND_API_KEY` + `EMAIL_FROM` (cadastro por código); opcional `ALERT_WEBHOOK_URL`.
4. **Render Starter** para eliminar o cold start de 30–50 s.
5. Rodar o smoke test de `docs/go-live-billing.md` §5.

> O frontend atual depende das rotas novas do backend e das migrations `034`–`045`. Subir só o frontend quebra cadastro e checkout.
