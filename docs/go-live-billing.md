# Go-live — Billing & Planos (AbacatePay)

**Atualizado em:** 18/10/2026
**Estado do código:** completo, testado e **no ar** — commit `cd5c7ce` (backend 161 testes verdes + typecheck limpo; frontend lint + build + 40 E2E verdes). Backend deployado em produção (`dep-dba4skajnfac73ecbiug`, live) e frontend novo servido em `https://temtrend.online`.
**Estado do go-live:** envs do Render ✅ (3 de 4) · webhook v2 criado ✅ · produto avulso excluído ✅ · rotas novas verificadas em produção ✅ · **pendente: `ABACATEPAY_API_KEY` (segredo seu — seção 2.1) e upgrade para Starter (seção 2.2)**. Enquanto a chave não existir, `GET /billing/plans` responde `enabled: false` e o app segue em modo legado — nada quebra.

> **Decisão de produto (18/10):** o plano grátis e a compra avulsa foram **removidos**. A plataforma agora é paga, com **7 dias de Pro de teste, sem cartão** como única porta de entrada grátis. Sem assinatura ativa, a conta fica no estado "sem plano": conteúdo existente continua visível, mas nada novo é gerado até assinar.

---

## 1. O que já está pronto

| Item | Estado |
|---|---|
| Módulo de billing no backend (checkout, cancelamento, troca de plano, webhook idempotente, gating por plano) | ✅ Código pronto, atrás da flag `BILLING_ENABLED` (padrão `false`) |
| Migrations `027_analytics_events`, `028_billing` e `029_support` | ✅ **Aplicadas em produção em 18/10/2026** (verificado via `information_schema`; advisors de segurança só com lints informativos pré-existentes) |
| Produtos `temtrend_*` na loja de produção AbacatePay | ✅ 6 produtos de assinatura ativos (mensal + anual de Essencial/Pro/Scale). Produto avulso **excluído em 18/10/2026** (seção 2.4) |
| Página `/planos` (pública, catálogo vem da API com fallback conservador; sem coluna "Grátis" e sem faixa avulsa) | ✅ |
| Card de plano real na conta (uso, trial, troca agendada, cancelamento, estado "sem plano" pós-trial) | ✅ |
| Faixa de status no topo do app (trial, trial encerrado, pagamento pendente, cancelada com acesso) + modal de upgrade no limite | ✅ |
| Trial Pro de 7 dias sem cartão no onboarding (só com billing ativo) | ✅ |
| **Canal de suporte in-platform** — creator abre/responde/encerra conversas em `/app/suporte`; até 5 conversas ativas; categorias, status e histórico | ✅ (novo) |
| **Painel admin atualizado** — abas Assinaturas (resumo + tabela de assinaturas) e Suporte (fila + resposta direto no painel), card de funil de eventos (30d) na visão geral, métricas de suporte/assinaturas | ✅ (novo) |
| Analytics de funil (`analytics_events` + `POST /events` + RPC `analytics_funnel` restrita ao service role) | ✅ (independente da flag) |

## 2. Render — backend (`temtrend-api`)

### 2.1 Variáveis de ambiente (Environment → Add)

| Variável | Valor | Estado em 18/10 |
|---|---|---|
| `BILLING_ENABLED` | `true` | ✅ Definida (o deploy de 18/10 já rodou com ela) |
| `ABACATEPAY_WEBHOOK_SECRET` | Segredo forte gerado em 18/10 (24 bytes em hex) | ✅ Definida (idêntica à do webhook v2) |
| `FRONTEND_URL` | `https://temtrend.online` | ✅ Definida (usada no `returnUrl`/`completionUrl` do checkout: `/app/conta` e `/app/conta?checkout=ok`) |
| `ABACATEPAY_API_KEY` | Chave de produção do painel AbacatePay (Bearer) | ⬜ **PENDENTE — a única ação que só você pode fazer:** Environment → Add → `ABACATEPAY_API_KEY` (a mesma chave de produção já usada nas integrações). Salvar já redeploya e liga a cobrança. |
| `ABACATEPAY_API_URL` | `https://api.abacatepay.com/v2` | ⬜ Opcional (o padrão do código já é esse) |

**Overrides de produto (opcionais).** Os IDs já estão no código como fallback (`plans.ts`); só defina se algum produto for recriado:

| Variável | Produto atual |
|---|---|
| `ABACATEPAY_PRODUCT_ESSENCIAL_MENSAL` | `prod_2hdyBwYWdbumAwpyYKkBFqkd` (R$ 29,90) |
| `ABACATEPAY_PRODUCT_ESSENCIAL_ANUAL` | `prod_1s5naWFB5UHjFqkSJJG3FWxD` (R$ 299) |
| `ABACATEPAY_PRODUCT_PRO_MENSAL` | `prod_p4cS64H2MtnhrrU4YjBCDmKp` (R$ 59,90) |
| `ABACATEPAY_PRODUCT_PRO_ANUAL` | `prod_f1hLdGkZnkmfu4ab2Pu4Jrt5` (R$ 599) |
| `ABACATEPAY_PRODUCT_SCALE_MENSAL` | `prod_XxZmftEJaNASwcC6WzXcYmKJ` (R$ 149) |
| `ABACATEPAY_PRODUCT_SCALE_ANUAL` | `prod_HpLjnExYMedtuqfTfGFT1GpZ` (R$ 1.490) |

> A env `ABACATEPAY_PRODUCT_AVULSO` foi **removida do código** — não existe mais variável para o produto avulso.

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

> Com `BILLING_ENABLED=false`, tudo volta ao comportamento atual (cotas globais antigas, sem trial, sem checkout, sem estado "sem plano") sem reverter migrations. O canal de suporte e o painel admin funcionam **independentes da flag**.

### 2.4 Arquivar o produto avulso legado

✅ **Feito em 18/10/2026:** o produto `prod_FKDSBDN4pECzrtmFgktGazXy` (R$ 19,90 — "kits extras") foi **excluído** da loja — não aparece mais em `listProducts`. Nenhum código o referenciava; a coluna `creators.kits_extra` foi removida na migration 029 (era 0 em produção — sem impacto em ninguém).

> **Produtos v1 legados ainda `ACTIVE` na conta** (não mexi — decida se quer arquivar; nenhum código os usa): `prod_XceU6kexeagzjrdExrUDAcBC` (Scale), `prod_nnEcHjTADLzMLkyb1LNPZPgn` (Pro), `prod_C202hdKwFjsDTHtGkFAjKWLR` (Essencial), `prod_cnLy302qRWrxncJWrdpPMaSW` (TemTrend Pro) e `prod_dLAMQ4LMFgCB121EaJh32PHP` (TemTrend Enterprise). A conta também tem produtos de outros projetos (WarHub/TrendPulse) — não mexer.

## 3. Webhook AbacatePay

**Endpoint:**

```
https://temtrend-api.onrender.com/billing/webhook?webhookSecret=<ABACATEPAY_WEBHOOK_SECRET>
```

> O segredo vai **na query string** e precisa ser idêntico ao valor da env `ABACATEPAY_WEBHOOK_SECRET`. Sem a env, a rota responde `503 WEBHOOK_DISABLED`; segredo errado → `401`. Existe rate limit de 300 req/min na rota.

**Eventos a assinar (7):**
`checkout.completed`, `transparent.completed`, `subscription.completed`, `subscription.trial_started`, `subscription.renewed`, `subscription.cancelled`, `subscription.payment_failed`.

> `subscription.plan_changed` **não é necessário**: a troca de plano é agendada localmente (`pending_plan`) e aplicada quando o `subscription.renewed` chega. Se chegar, é ignorado com segurança.

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

**Webhook legado:** `webh_prod_mL3zBmjAFAfmAZnPaAbnFw0y` → `https://temtrend.online/` (eventos v1). Deixar como está até arquivar os produtos legados; depois remover no painel para não gerar ruído.

## 4. Migrations

As migrations `027_analytics_events`, `028_billing` e `029_support` **já estão aplicadas em produção** (aplicadas em 18/10/2026 via MCP, verificadas em `information_schema`). Nenhuma ação de banco pendente.

- `029_support` cria `support_tickets` + `support_messages`, a RPC `analytics_funnel(p_days)` (grant só para `service_role`) e **remove `creators.kits_extra`**.
- RLS habilitada **sem policies** nas tabelas novas (`analytics_events`, `subscriptions`, `billing_events`, `support_tickets`, `support_messages`): acesso exclusivo da API com service role. Intencional — advisors de segurança sem alertas.
- As migrations locais (`backend/supabase/migrations/`) permanecem como registro.

## 5. Smoke test pós-deploy (≈15 min)

| # | Passo | Esperado |
|---|---|---|
| 1 | `GET https://temtrend-api.onrender.com/billing/plans` | Catálogo 200 (essencial, pro, scale, enterprise; `trial_days: 7`; sem `free`/`avulso`) — **✅ já verificado**; `enabled: true` só **depois** da `ABACATEPAY_API_KEY` |
| 2 | Conta nova (com billing ativo): concluir onboarding | Faixa "Trial Pro · 7 dias restantes"; limites de Pro valendo |
| 3 | Aguardar fim do trial (ou forçar `plan_status` no banco) | Faixa "trial encerrado" + estado travado: gerar/buscar bloqueado com mensagem neutra de assinatura; conteúdo antigo visível |
| 4 | `/planos` logado → Assinar Pro mensal (PIX) | Redireciona ao checkout; após pagar, webhook ativa; `/app/conta` mostra plano + "Renova em …" |
| 5 | `/planos` → "Mudar para Pro anual" | "Mudança agendada para o próximo ciclo"; aplicada no `subscription.renewed` |
| 6 | `/app/conta` → Cancelar assinatura | "Acesso até dd/mm" (mantém até o fim do período; nada é apagado) |
| 7 | `/app/suporte` → abrir conversa | Conversa aparece na fila do admin (`/app/admin` → Suporte); resposta do admin chega no mesmo fio; responder reabre a conversa |
| 8 | Reenviar o mesmo webhook no painel | Resposta `duplicate`, sem efeito duplo |
| 9 | AbacatePay: trocar o segredo do webhook por um errado e reenviar | `401` (e depois restaurar) |

> **Verificado em produção em 18/10 (com o código novo, antes da chave):** `GET /health` → 200 · `GET /billing/plans` → 200 (essencial, pro, scale, enterprise; `trial_days: 7`; sem `free`/`avulso`) · `POST /billing/webhook` sem segredo → 401 (segredo ativo) · `POST /support/tickets` → 401 e `GET /admin/billing/summary` → 401 (rotas novas registradas; auth exigida) · `POST /events` com corpo vazio → 400 (validação ok) · frontend `https://temtrend.online/planos` e `/app/suporte` → 200 (build novo no ar).
>
> **Passos 2–8 do smoke completo só rodam com a `ABACATEPAY_API_KEY` definida** (sem ela não há trial nem checkout). O passo 9 já está coberto pelo teste do 401 acima.

## 6. Pendências conhecidas (honesto)

- **⬜ Ações humanas pendentes (go-live):** (1) adicionar `ABACATEPAY_API_KEY` no Render (§2.1 — liga a cobrança no próximo redeploy; a flag já está `true`); (2) subir para Starter (§2.2); (3) opcional: arquivar os produtos v1 e o webhook `TemTrend.AI` (§2.4/§3).
- **E-mails de trial/renovação (Resend):** não implementados — ficam para a fase 3 (Retenção & expansão). Hoje o trial é comunicado dentro do app.
- **Notificações de suporte:** o canal é in-app (creator vê resposta na área Suporte); e-mail de "resposta nova" ainda não existe.
- **Nota fiscal / contador:** fora do escopo do código (imposto de 6% é premissa do relatório).
- **Programa de indicação e dashboard de ROI:** roadmap fase 3, não implementados.
