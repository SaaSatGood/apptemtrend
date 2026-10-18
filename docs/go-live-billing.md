# Go-live — Billing & Planos (AbacatePay)

**Atualizado em:** 18/10/2026
**Estado do código:** completo e testado (backend 161 testes verdes + typecheck limpo; frontend lint + build + 40 E2E verdes). Nada foi commitado/pushado ainda — o deploy depende do push do trabalho atual.

> **Decisão de produto (18/10):** o plano grátis e a compra avulsa foram **removidos**. A plataforma agora é paga, com **7 dias de Pro de teste, sem cartão** como única porta de entrada grátis. Sem assinatura ativa, a conta fica no estado "sem plano": conteúdo existente continua visível, mas nada novo é gerado até assinar.

---

## 1. O que já está pronto

| Item | Estado |
|---|---|
| Módulo de billing no backend (checkout, cancelamento, troca de plano, webhook idempotente, gating por plano) | ✅ Código pronto, atrás da flag `BILLING_ENABLED` (padrão `false`) |
| Migrations `027_analytics_events`, `028_billing` e `029_support` | ✅ **Aplicadas em produção em 18/10/2026** (verificado via `information_schema`; advisors de segurança só com lints informativos pré-existentes) |
| Produtos `temtrend_*` na loja de produção AbacatePay | ✅ 6 produtos de assinatura (mensal + anual de Essencial/Pro/Scale). Produto avulso legado deve ser **arquivado** (seção 2.4) |
| Página `/planos` (pública, catálogo vem da API com fallback conservador; sem coluna "Grátis" e sem faixa avulsa) | ✅ |
| Card de plano real na conta (uso, trial, troca agendada, cancelamento, estado "sem plano" pós-trial) | ✅ |
| Faixa de status no topo do app (trial, trial encerrado, pagamento pendente, cancelada com acesso) + modal de upgrade no limite | ✅ |
| Trial Pro de 7 dias sem cartão no onboarding (só com billing ativo) | ✅ |
| **Canal de suporte in-platform** — creator abre/responde/encerra conversas em `/app/suporte`; até 5 conversas ativas; categorias, status e histórico | ✅ (novo) |
| **Painel admin atualizado** — abas Assinaturas (resumo + tabela de assinaturas) e Suporte (fila + resposta direto no painel), card de funil de eventos (30d) na visão geral, métricas de suporte/assinaturas | ✅ (novo) |
| Analytics de funil (`analytics_events` + `POST /events` + RPC `analytics_funnel` restrita ao service role) | ✅ (independente da flag) |

## 2. Render — backend (`temtrend-api`)

### 2.1 Variáveis de ambiente (Environment → Add)

| Variável | Valor | Obrigatória |
|---|---|---|
| `BILLING_ENABLED` | `true` | Sim, para ligar a cobrança |
| `ABACATEPAY_API_KEY` | Chave de produção do painel AbacatePay (Bearer) | Sim |
| `ABACATEPAY_WEBHOOK_SECRET` | Segredo forte que você define (mín. 8 caracteres) | Sim |
| `FRONTEND_URL` | `https://temtrend.online` | Sim (usado no `returnUrl`/`completionUrl` do checkout: `/app/conta` e `/app/conta?checkout=ok`) |
| `ABACATEPAY_API_URL` | `https://api.abacatepay.com/v2` | Não (padrão já é esse) |

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

Service `temtrend-api` → **Settings → Instance Type → Starter** (~US$ 7/mês). Isso elimina o cold start de ~30–50s que hoje afeta o primeiro acesso e o onboarding.

### 2.3 Ordem do deploy

1. Commit + push do trabalho atual (backend pega as rotas novas de billing + suporte; com `BILLING_ENABLED` ainda ausente/false nada muda para os usuários).
2. Definir as envs da seção 2.1 (isso liga a cobrança).
3. Subir para Starter (2.2).
4. Criar o webhook (seção 3) **depois** do deploy — a rota `/billing/webhook` só existe no código novo.
5. Arquivar o produto avulso legado (2.4).
6. Rodar o smoke test (seção 5).

> Com `BILLING_ENABLED=false`, tudo volta ao comportamento atual (cotas globais antigas, sem trial, sem checkout, sem estado "sem plano") sem reverter migrations. O canal de suporte e o painel admin funcionam **independentes da flag**.

### 2.4 Arquivar o produto avulso legado

O produto `prod_FKDSBDN4pECzrtmFgktGazXy` (R$ 19,90 — "kits extras") não é mais vendido. No painel AbacatePay, **arquivar/desativar** esse produto para não ficar disponível em links antigos. Nenhum código o referencia; a coluna `creators.kits_extra` foi removida na migration 029 (dados zerados — sem impacto em ninguém, era 0 em produção).

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

**Webhook legado:** `webh_prod_mL3zBmjAFAfmAZnPaAbnFw0y` → `https://temtrend.online/` (eventos v1). Deixar como está até arquivar os produtos legados; depois remover no painel para não gerar ruído.

## 4. Migrations

As migrations `027_analytics_events`, `028_billing` e `029_support` **já estão aplicadas em produção** (aplicadas em 18/10/2026 via MCP, verificadas em `information_schema`). Nenhuma ação de banco pendente.

- `029_support` cria `support_tickets` + `support_messages`, a RPC `analytics_funnel(p_days)` (grant só para `service_role`) e **remove `creators.kits_extra`**.
- RLS habilitada **sem policies** nas tabelas novas (`analytics_events`, `subscriptions`, `billing_events`, `support_tickets`, `support_messages`): acesso exclusivo da API com service role. Intencional — advisors de segurança sem alertas.
- As migrations locais (`backend/supabase/migrations/`) permanecem como registro.

## 5. Smoke test pós-deploy (≈15 min)

| # | Passo | Esperado |
|---|---|---|
| 1 | `GET https://temtrend-api.onrender.com/billing/plans` | `enabled: true` com Essencial/Pro/Scale (mensal + anual) — **sem** chaves `free` e `avulso` |
| 2 | Conta nova (com billing ativo): concluir onboarding | Faixa "Trial Pro · 7 dias restantes"; limites de Pro valendo |
| 3 | Aguardar fim do trial (ou forçar `plan_status` no banco) | Faixa "trial encerrado" + estado travado: gerar/buscar bloqueado com mensagem neutra de assinatura; conteúdo antigo visível |
| 4 | `/planos` logado → Assinar Pro mensal (PIX) | Redireciona ao checkout; após pagar, webhook ativa; `/app/conta` mostra plano + "Renova em …" |
| 5 | `/planos` → "Mudar para Pro anual" | "Mudança agendada para o próximo ciclo"; aplicada no `subscription.renewed` |
| 6 | `/app/conta` → Cancelar assinatura | "Acesso até dd/mm" (mantém até o fim do período; nada é apagado) |
| 7 | `/app/suporte` → abrir conversa | Conversa aparece na fila do admin (`/app/admin` → Suporte); resposta do admin chega no mesmo fio; responder reabre a conversa |
| 8 | Reenviar o mesmo webhook no painel | Resposta `duplicate`, sem efeito duplo |
| 9 | AbacatePay: trocar o segredo do webhook por um errado e reenviar | `401` (e depois restaurar) |

## 6. Pendências conhecidas (honesto)

- **E-mails de trial/renovação (Resend):** não implementados — ficam para a fase 3 (Retenção & expansão). Hoje o trial é comunicado dentro do app.
- **Notificações de suporte:** o canal é in-app (creator vê resposta na área Suporte); e-mail de "resposta nova" ainda não existe.
- **Nota fiscal / contador:** fora do escopo do código (imposto de 6% é premissa do relatório).
- **Programa de indicação e dashboard de ROI:** roadmap fase 3, não implementados.
