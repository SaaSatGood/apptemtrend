# Go-live — Billing & Planos (AbacatePay)

**Atualizado em:** 13/11/2026
**Estado do código:** completo e testado. Migrations até `045` aplicadas no projeto Supabase verificado (ver `backend/supabase/migrations/README.md`). Backend em `temtrend-api.onrender.com` e frontend em `https://www.temtrend.com`.
**Estado do go-live:** **o deploy de produção ainda roda o código anterior ao redesign atual e precisa ser atualizado**. Depois do redeploy, faltam: `ABACATEPAY_API_KEY` e/ou `ASAAS_API_KEY` (seção 2.1), `RESEND_API_KEY` + `EMAIL_FROM` (obrigatórios para o cadastro por código) e o upgrade para Starter (seção 2.2). Sem as chaves de pagamento, `GET /billing/plans` responde `enabled: false` e o app segue sem checkout — os limites do Grátis continuam valendo e nada quebra.

> **Decisão de produto e estágio atual:** 
> - **Plano Pro único** (R$ 49,90/mês ou R$ 499/ano). A condição de lançamento (R$ 39,90/mês ou R$ 399/ano) foi encerrada para novas vendas e permanece apenas nas renovações de assinantes antigos. Kits de conteúdo e buscas **ilimitados** (sem cotas diárias; política interna de uso justo de 1.000 kits/mês para segurança).
> - **Plano Grátis:** 100 buscas por semana (reset toda segunda) e 10 roteiros por semana (reset toda segunda). A aba Produtos (catálogo completo) é exclusiva do Pro.
> - **Enterprise:** Sob consulta para grandes operações.
> - **Planos Aposentados:** Os antigos planos Essencial e Scale e compras avulsas de kits foram **removidos do catálogo de vendas**, preservados apenas no backend para compatibilidade com assinaturas legadas.

---

## 1. O que já está pronto

| Item | Estado |
|---|---|
| Módulo de billing no backend (Cartão via Asaas + PIX via AbacatePay, cancelamento, webhooks idempotentes, reserva de vaga de lançamento via advisory lock) | ✅ Código pronto, atrás da flag `BILLING_ENABLED` |
| Migrations `027` a `045` (billing, suporte, agendamento, links compartilhados, leads, códigos de e-mail e cotas) | ✅ **Aplicadas no projeto Supabase verificado** (o import `033` já está refletido no catálogo) |
| Cadastro por código de 6 dígitos (Resend) | ✅ Código pronto; **exige `RESEND_API_KEY` e `EMAIL_FROM`** no Render |
| Sessão persistida, onboarding retomável, links compartilháveis, calendário e planejador semanal | ✅ Código pronto |
| Produtos `temtrend_*` na loja de produção AbacatePay | ✅ Produtos ativos para Pro e Lançamento (recorrente + PIX avulso). Essencial e Scale arquivados do catálogo |
| Página `/planos` (pública, catálogo vem da API com fallback; destaca Pro e vagas de lançamento) | ✅ |
| Card de plano na conta (uso do plano, renovação, preço de lançamento ativo, cancelamento) | ✅ |
| Plano Grátis no onboarding (100 buscas/semana e 10 roteiros/semana; catálogo completo no Pro) | ✅ |
| **Canal de suporte in-platform** — creator abre/responde/encerra conversas em `/suporte`; até 5 conversas ativas; categorias, status e histórico | ✅ |
| **Painel admin atualizado** — abas Assinaturas (resumo + tabela de assinaturas) e Suporte (fila + resposta direto no painel), card de funil de eventos (30d) na visão geral, métricas de suporte/assinaturas | ✅ |
| Analytics de funil (`analytics_events` + `POST /events` + RPC `analytics_funnel` restrita ao service role) | ✅ |

## 2. Render — backend (`temtrend-api`)

### 2.1 Variáveis de ambiente (Environment → Add)

| Variável | Valor | Estado |
|---|---|---|
| `BILLING_ENABLED` | `true` | ✅ Definida |
| `ABACATEPAY_WEBHOOK_SECRET` | Segredo forte gerado (24 bytes em hex) | ✅ Definida (idêntica à do webhook v2) |
| `FRONTEND_URL` | `https://www.temtrend.com` | ⚠️ **Confirmar no Render** — se ainda estiver `temtrend.online`, troque para o domínio canônico |
| `ABACATEPAY_API_KEY` | Chave de produção do painel AbacatePay (Bearer) | ⬜ **PENDENTE — ação do dono:** Environment → Add → `ABACATEPAY_API_KEY`. Salvar já redeploya e liga o checkout PIX. |
| `ABACATEPAY_API_URL` | `https://api.abacatepay.com/v2` | ⬜ Opcional (o padrão do código já é esse) |
| `ASAAS_API_KEY` | Chave de produção do Asaas | ✅ Definida em 30/10 |
| `ASAAS_API_URL` | `https://api.asaas.com` | ✅ Definida em 30/10 |
| `ASAAS_WEBHOOK_TOKEN` | Token do webhook Asaas (header `asaas-access-token`) | ✅ Definida em 30/10 |
| `ASAAS_CALLBACK_BASE_URL` | URL pública HTTPS de retorno (`https://www.temtrend.com`); localhost é rejeitado pelo Asaas | ⚠️ **Confirmar no Render** — atualizar para o domínio canônico |
| `RESEND_API_KEY` | Chave do Resend para enviar o código de confirmação do cadastro | ⬜ **Obrigatória** — sem ela, o cadastro por e-mail responde 503 e desfaz a conta |
| `EMAIL_FROM` | Remetente verificado, ex.: `TemTrend <nao-responda@temtrend.com>` | ⬜ **Obrigatória** com a chave acima |
| `AI_QUOTA_STORE` | `database` em produção (cota semanal do Grátis e cota do suporte) | ✅ Padrão em produção |
| `OPENCODE_API_KEY` / `GEMINI_API_KEY` | Pelo menos um provedor de IA; há fallback determinístico | ✅ `gemini` configurado em 13/11 |
| `ALERT_WEBHOOK_URL` | Webhook Slack/Discord que recebe alertas de erro 5xx | ⬜ Recomendado antes do lançamento |

**Produtos ativos na AbacatePay:**

| Oferta | Produto Recorrente | Produto PIX Avulso |
|---|---|---|
| Pro mensal (R$ 49,90) | `prod_Jt2hbA4rBeCeGrbaPsUUEccb` | `prod_XxNqutEGTfFTs4QHxf2WtbpA` |
| Pro anual (R$ 499) | `prod_xR2MWUbe1AkdHqjK5EN6yPpJ` | `prod_SeQfXsLnBUxnZ0bBstzXZUE5` |
| Lançamento mensal (R$ 39,90) | `prod_X35W1dnyXLA055ZewPZG6gMK` | `prod_23bJx2ZaU3EsaHYLSRuL6Rt3` |
| Lançamento anual (R$ 399) | `prod_gqppYRSSdKnHBZJKSBRpw0Jx` | `prod_XjpDTmMur4wqMQtZAJ0fGA5T` |

> *Produtos legados Essencial e Scale permanecem identificados apenas como fallback no código (`LEGACY_PRODUCTS`), mas não estão disponíveis para contratação.*
>
> **Cartão:** usa Checkout recorrente do Asaas (`CREDIT_CARD` + `RECURRENT`), sem produtos da AbacatePay. Webhook Asaas: `https://temtrend-api.onrender.com/billing/webhook/asaas`. O webhook foi criado em 30/10 com `interrupted: true`; ativar depois que o código com a rota `/billing/webhook/asaas` estiver em produção. **PIX:** segue no AbacatePay.

### 2.2 Render Starter (item 6 do relatório)

**⬜ Pendente (ação manual — é cobrança no Render).** Service `temtrend-api` → **Settings → Instance Type → Starter** (~US$ 7/mês). Isso elimina o cold start de ~30–50s que hoje afeta o primeiro acesso e o onboarding.

### 2.3 Ordem do deploy

1. ✅ Commit + push (`cd5c7ce`) — código novo no ar.
2. ⚠️ Parcial — `BILLING_ENABLED`, `ABACATEPAY_WEBHOOK_SECRET` e `FRONTEND_URL` definidas em 18/10; falta a `ABACATEPAY_API_KEY` (2.1).
3. ⬜ Starter (2.2) — manual.
4. ✅ Webhook v2 criado em 18/10 — `webh_prod_xS6hzaujufu2sQxkpYpAZ434` (seção 3).
5. ✅ Produto avulso excluído em 18/10 (2.4).
6. ⏳ Smoke test parcialmente executado (seção 5).

> ⚠️ **Auto-deploy do Render:** o push para `main` **não** disparou deploy automático — o deploy de 18/10 saiu junto com o update de envs (via API). Todos os deploys do serviço constam com `trigger: api`. Se quiser deploy automático a cada push, confira em **Settings → Build & Deploy → Auto-Deploy** (reconectar o GitHub App do Render); caso contrário, dispare manualmente (Dashboard → Deploys → Deploy latest commit).

> Com `BILLING_ENABLED=false` (ou sem `ABACATEPAY_API_KEY`), não há checkout: os limites do Grátis continuam valendo e os planos pagos ficam sem o teto de uso justo. O canal de suporte e o painel admin funcionam **independentes da flag**.

### 2.4 Arquivar o produto avulso legado

✅ **Feito em 18/10/2026:** o produto `prod_FKDSBDN4pECzrtmFgktGazXy` (R$ 19,90 — "kits extras") foi **excluído** da loja — não aparece mais em `listProducts`. Nenhum código o referenciava; a coluna `creators.kits_extra` foi removida na migration 029 (era 0 em produção — sem impacto em ninguém).

> **Produtos v1 legados ainda `ACTIVE` na conta** (não mexi — decida se quer arquivar; nenhum código os usa): `prod_XceU6kexeagzjrdExrUDAcBC` (Scale), `prod_nnEcHjTADLzMLkyb1LNPZPgn` (Pro), `prod_C202hdKwFjsDTHtGkFAjKWLR` (Essencial), `prod_cnLy302qRWrxncJWrdpPMaSW` (TemTrend Pro) e `prod_dLAMQ4LMFgCB121EaJh32PHP` (TemTrend Enterprise). A conta também tem produtos de outros projetos (WarHub/TrendPulse) — não mexer.

### 2.5 Ordem do deploy coordenado (obrigatória)

O frontend atual depende de rotas novas do backend (`/auth/signup`,
`/auth/verify-code`, `/auth/password/*`, `/share/*`, `/billing/subscription`,
`/events`) e das migrations `034`–`045`. **Não suba só o frontend.**

1. **Backend primeiro:** commit + push e deploy no Render do `temtrend-api`.
   Confirme `GET /health` e `GET /ready` 200 e `GET /billing/plans` com
   `free.searches_per_week: 100` e `free.kits_per_week: 10`.
2. **Confirme as envs novas** (`RESEND_API_KEY`, `EMAIL_FROM`, chaves de
   pagamento) — sem elas o cadastro/checkout falham de forma explícita.
3. **Frontend depois:** commit + push; o deploy de produção é o projeto Vercel
   **`apptemtrend`** (domínio `www.temtrend.com`), com Root Directory
   `frontend`. O projeto Vercel `temtrend` é um resto de teste e falha por não
   ter `package.json` na raiz — **não é o de produção**. Recomendado: configurar
   `temtrend.com` (apex) com redirect 308 para `www.temtrend.com`, para não
   duplicar canonical.
4. Rode o smoke test da seção 5.

> A última implantação de produção (`apptemtrend`) é o commit `b1eb7f2`. O
> redesign atual está no working tree e ainda **não foi commitado/deployado**.

## 3. Webhook AbacatePay

**Endpoint:**

```
https://temtrend-api.onrender.com/billing/webhook?webhookSecret=<ABACATEPAY_WEBHOOK_SECRET>
```

> O segredo vai **na query string** e precisa ser idêntico ao valor da env `ABACATEPAY_WEBHOOK_SECRET`. Sem a env, a rota responde `503 WEBHOOK_DISABLED`; segredo errado → `401`. Existe rate limit de 300 req/min na rota.

**Eventos a assinar (7):**
`checkout.completed`, `transparent.completed`, `subscription.completed`, `subscription.trial_started`, `subscription.renewed`, `subscription.cancelled`, `subscription.payment_failed`.

> `subscription.plan_changed` **não é necessário**: a troca de plano é agendada localmente (`pending_plan`) e aplicada quando o `subscription.renewed` chega. Se chegar, é ignorado com segurança.
>
> `subscription.trial_started` está na lista só por segurança: a plataforma **não vende trial**, então o evento é ignorado de propósito (`billing.service.ts`, `handleEvent`) — ele não comprova pagamento e não ativa assinatura.

**Criar pelo painel AbacatePay** (Webhooks → Criar) com os dados acima, ou via MCP `abacate-pay.createWebhook`:

```
createWebhook({
  name: "temtrend-v2",
  endpoint: "https://temtrend-api.onrender.com/billing/webhook?webhookSecret=<SEGREDO>",
  secret: "<SEGREDO>",
  events: [ ...os 7 acima... ]
})
```

**Status:** ✅ criado em 18/10/2026 via MCP — id `webh_prod_xS6hzaujufu2sQxkpYpAZ434`, nome `temtrend-v2`, com o segredo na query string (idêntico à env). Verificado em produção: sem segredo → `401` (a env do segredo está ativa).

> A conta AbacatePay também serve outros projetos (WarHub) — os eventos disparam para **todos** os webhooks da conta e cada endpoint filtra o que interessa. Do nosso lado, nada a fazer.

**Webhook legado:** `webh_prod_mL3zBmjAFAfmAZnPaAbnFw0y` → `https://www.temtrend.com/` (eventos v1). Deixar como está até arquivar os produtos legados; depois remover no painel para não gerar ruído.

## 4. Migrations

As migrations de `027_analytics_events` a `045_quota_support_kind` **estão aplicadas no projeto Supabase verificado em 13/11/2026** (histórico completo em `backend/supabase/migrations/README.md`).

- `029_support` cria `support_tickets` + `support_messages`, a RPC `analytics_funnel(p_days)` (grant só para `service_role`) e remove `creators.kits_extra`.
- `031_pricing_launch_fair_use` e `032_launch_seats_distinct` criam o controle atômico de assentos de lançamento (`claim_launch_seat` para até 100 vagas com advisory lock) e campos de modo de cobrança.
- `034`, `036`, `041` e `042` sustentam agendamento editorial, links compartilháveis, confirmação de e-mail por código e recuperação de senha.
- `044` unifica a cota semanal do Grátis; `045` corrige a cota do suporte (`p_kind='support'`).
- RLS habilitada sem policies nas tabelas de infraestrutura: acesso exclusivo da API com service role. Intencional — advisors de segurança sem alertas.
- `033` é um import idempotente de catálogo; os ~3,7 mil produtos ativos já refletem a carga.

Se o projeto de produção for outro, revalide o status lá antes de aplicar (as migrations são idempotentes).

## 5. Smoke test pós-deploy (≈15 min)

| # | Passo | Esperado |
|---|---|---|
| 1 | `GET https://temtrend-api.onrender.com/billing/plans` | Catálogo 200 (plano `pro` com destaque, `launch` disponível com vagas e preço, `enterprise` sob consulta; `free` com 100 buscas/semana e 10 roteiros/semana) |
| 2 | Conta nova (onboarding) | Plano Grátis ativo, com 100 buscas/semana e 10 roteiros/semana |
| 3 | Esgotar a cota gratuita de roteiros | Alerta amigável convidando para o Pro ilimitado |
| 3b | Abrir a aba Produtos no Grátis | Paywall do catálogo completo, com CTA para o Pro e busca do Descobrir liberada |
| 4 | `/planos` logado → escolher Cartão ou PIX → Assinar Pro | PIX abre o checkout da AbacatePay; cartão abre o checkout recorrente do Asaas. Após pagar, o webhook ativa. Cartão renova automaticamente; PIX vale pelo período e renova pela conta. `/conta` mostra status ativo no valor cheio (R$ 49,90/mês ou R$ 499/ano) |
| 5 | Criação de roteiros no Pro | Geração ilimitada de kits e buscas sem contadores ou bloqueios de cotas diárias (sujeito apenas a teto interno de segurança de 1.000/mês contra abuso) |
| 6 | `/conta` → Cancelar assinatura | "Acesso até dd/mm" (mantém acesso até o fim do ciclo pago; nenhum roteiro é apagado) |
| 7 | `/suporte` → abrir conversa | Conversa aparece na fila do admin (`/admin` → Suporte); resposta do admin chega no mesmo fio |
| 8 | Reenviar o mesmo webhook no painel | Resposta `duplicate`, idempotência garantida |
| 9 | AbacatePay: trocar o segredo do webhook por um errado e reenviar | `401` retornado |

> **Passos com checkout dependem de `ABACATEPAY_API_KEY` (PIX) ou `ASAAS_API_KEY` (cartão) ativas no Render. O cadastro depende de `RESEND_API_KEY` + `EMAIL_FROM`.**

## 6. Pendências conhecidas (honesto)

- **⬜ Ações humanas pendentes (go-live):** (1) **fazer o deploy do código atual** — produção ainda roda o build anterior (limites 3/3 e rotas `/app/*`); (2) adicionar `ABACATEPAY_API_KEY` (PIX) e confirmar `ASAAS_API_KEY` (cartão) no Render (§2.1); (3) adicionar `RESEND_API_KEY` e `EMAIL_FROM` (cadastro por código); (4) subir para Starter (§2.2); (5) opcional: arquivar os produtos v1 e o webhook `TemTrend.AI` (§2.4/§3).
- **E-mails de renovação/cobrança (Resend):** não implementados — ficam para a fase 3 (Retenção & expansão). Hoje o aviso de renovação aparece apenas na conta. **Não existe trial**: o Grátis não tem renovação automática e o Pro é cobrado desde o primeiro ciclo (`trial_days: 0`).
- **E-mails transacionais:** por enquanto só o código de confirmação de cadastro e o código de recuperação de senha usam o Resend. Não há e-mail de "resposta nova no suporte" nem lembrete de renovação.
- **Notificações de suporte:** o canal é in-app (creator vê resposta na área Suporte); e-mail de "resposta nova" ainda não existe.
- **Nota fiscal / contador:** fora do escopo do código (imposto de 6% é premissa do relatório).
- **Programa de indicação e dashboard de ROI:** roadmap fase 3, não implementados.
