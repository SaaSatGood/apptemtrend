# Relatório Completo — TemTrend
### Produto · Preço · Design

**Data:** 18/10/2026 · **Versão:** 2.0 (consolida o relatório de melhorias v1 + o estudo de precificação + auditoria de design)
**Método:** skill `revenue-centric-design` (134 princípios de [@richardrx](https://x.com/richardrx)) + skills `redesign-existing-projects` e `web-design-guidelines`, cruzadas com inspeção do código atual (frontend Next.js 16 / React 19 + backend Fastify/Gemini/Supabase) e verificação do catálogo na AbacatePay via API.

**Escopo:** aquisição, cadastro, ativação, núcleo do produto, retenção, monetização, precificação, posicionamento, métricas e interface.

> ⚠️ **Licença e escopo da skill.** O material de Revenue-Centric Design é de uso livre sob uma condição: **nunca** para produtos de apostas/cassino/gambling. A TemTrend é uma plataforma de conteúdo para afiliados do TikTok Shop — o uso é permitido.
>
> 📌 **Na redação deste relatório nenhuma alteração de código foi feita.** O catálogo AbacatePay foi consultado apenas em leitura. Este é um diagnóstico com recomendações, cada uma ancorada em evidência (`arquivo:linha`), princípio (com fonte) e movimento concreto.

---

> ## ✅ Status de implementação — 18/10/2026
>
> O relatório foi **implementado em código** na sequência P0 → P1 → P2 viável. Nada foi commitado nem deployado ainda — o push é decisão sua. Top 12:
>
> | # | Ação | Status | Onde |
> |---|---|---|---|
> | 1 | Persistir a sessão | ✅ | `frontend/lib/supabase.ts` (`persistSession: true`) |
> | 2 | Instrumentar o funil (ativação, TTV, D1/D7) | ✅ | migration `027_analytics_events` (**aplicada em produção**) + `frontend/lib/track.ts` + `POST /events` |
> | 3 | Billing + gating por plano | ✅ (flag `BILLING_ENABLED`, padrão `false`) | `backend/src/modules/billing/*` — 150 testes verdes |
> | 4 | Reconciliar `DESIGN.md` ↔ código | ✅ | `styles/canonical.css` importado por último; tokens = `DESIGN.md` |
> | 5 | Persistir o onboarding (barra > 0%) | ✅ | rascunho `temtrend_onboarding:<user_id>` + restauração |
> | 6 | Render Starter (matar o cold start) | ⏳ passo manual | `docs/go-live-billing.md` §2.2 |
> | 7 | Prova social real + copy de resultado | ✅ (sem depoimento inventado) | faixa `.tt-facts` + copy de resultado na landing |
> | 8 | Kit de exemplo antes do cadastro | ✅ | seção "Plano de gravação" da landing |
> | 9 | `/planos` + card na conta + modal de upgrade | ✅ | `app/planos/`, `Account.tsx`, `UpgradeDialog.tsx`, `PlanBanner.tsx` |
> | 10 | Acessibilidade (foco, 44px, contraste, tabular-nums) | ✅ | 84 ajustes + camada canônica |
> | 11 | Linha `creator_*` na AbacatePay + arquivar legado | ✅ / ⏳ | 6 produtos `temtrend_*` de assinatura criados; arquivar avulso + legados é passo manual (guia §2.4/§3) |
> | 12 | Painel de ROI + celebração de ativação | ⏳ fase 3 | — |
>
> **Decisão de produto (18/10, 2ª rodada):** plano grátis e compra avulsa **removidos** — plataforma paga, com trial Pro de 7 dias sem cartão como única entrada grátis e estado "sem plano" (travado, conteúdo antigo visível) depois. Em troca, foi entregue **canal de suporte in-platform** (`/app/suporte`) conectado ao **painel admin modernizado** (abas Assinaturas e Suporte, funil 30d na visão geral).
>
> **Backlog de produto:** reenvio de confirmação de e-mail ✅; link do TikTok validado em "publicado" ✅ (`validTikTokUrl` em `Production.tsx`); tela de cancelamento ✅ (modal na conta); código morto da landing ✅ (verificado: `lib/landing-data.ts` está em uso); links de saída do Pexels ✅ (atribuição em texto, sem link). **Fase 3:** persistir progresso de gravação no servidor, painel de ROI + streak, sample data na Produção, auditoria de LCP/peso, redução de variantes de easing.
>
> **Migrations `027`, `028` e `029`:** aplicadas em produção em 18/10/2026 (verificado em `information_schema`; advisors de segurança sem alertas). A `029_support` cria o suporte (`support_tickets`/`support_messages` + RPC de funil) e remove `creators.kits_extra`. **Guia de go-live da cobrança:** `docs/go-live-billing.md`.
>
> **Verificações da implementação:** backend `typecheck` + 161 testes ✅ · frontend `lint` + `build` ✅ · E2E 40 testes ✅.

---

## Como ler este relatório

| Parte | Tema | Para quem |
|---|---|---|
| **I** | Produto & Funil (Revenue-Centric Design) | Produto, design, growth |
| **II** | Precificação & Monetização | Você / sócio / financeiro |
| **III** | Design & Interface | Design, front-end |
| **IV** | Roadmap unificado | Todos |
| Anexos | Princípios, tokens, premissas, fontes | Referência |

Cada recomendação tem prioridade **P0** (destrava receita/retenção agora), **P1** (conversão e credibilidade, 2–4 semanas) ou **P2** (polimento e longo prazo).

---

## Sumário executivo

A TemTrend chegou ao ponto raro de ter **produto pronto para cobrar**: descoberta de produtos com IA, plano de gravação completo em 8 partes, guia cena a cena e pipeline de produção. O motor funciona. O que falta não é produto — é a **camada que transforma uso em receita e visita em confiança**.

Três lacunas estruturais dominam tudo o mais:

1. **Receita zero.** O "Plano gratuito" é um literal no código (`backend/src/modules/account/account.routes.ts:35`) — sem assinatura, trial ou paywall. É um produto que roda **tokens de IA de graça para o usuário**.
2. **Persistência zero.** A sessão vive só em memória (`frontend/lib/supabase.ts:30-33`, `persistSession:false`): recarregar a página desloga **e reinicia o onboarding**. É churn de dia 1 estrutural — e a correção é barata.
3. **Prova zero.** A landing não tem um único depoimento, número ou print real; as imagens são de acervo rotuladas como tal (`frontend/app/creator-carousel.tsx:125`). A headline descreve o que o produto faz, mas não para quem nem o resultado.

Somando o eixo **design**: o sistema visual documentado (`DESIGN.md`) **não é o sistema implementado** — 6 de 10 cores divergem, há 22 arquivos CSS globais (366 KB) com camadas concorrentes e resíduos da antiga marca TikTok. A interface é boa na intenção e frágil na manutenção.

### Top 12 ações priorizadas (visão unificada)

| # | Ação | Frente | Impacto | Esforço | Prio |
|---|---|---|---|---|---|
| 1 | **Persistir a sessão** (fim do logout por reload) | Produto | 🔴 Altíssimo | S | P0 |
| 2 | **Instrumentar o funil** (eventos de ativação, TTV, D1/D7) | Métricas | 🔴 Altíssimo | M | P0 |
| 3 | **Implementar billing + gating por plano** (base da receita) | Preço | 🔴 Altíssimo | L | P0 |
| 4 | **Reconciliar DESIGN.md ↔ código** e unificar tokens | Design | 🟠 Alto | M | P0 |
| 5 | **Persistir o onboarding** + barra começa >0% | Produto | 🟠 Alto | S | P0 |
| 6 | **Subir infra de cobrança** (Render Starter — mata cold start) | Preço | 🟠 Alto | S | P0 |
| 7 | **Prova social real + copy de resultado** na landing | Produto/Design | 🟠 Alto | M | P1 |
| 8 | **Mostrar o produto antes do cadastro** (kit de exemplo) | Produto | 🟠 Alto | M | P1 |
| 9 | **Página `/planos` (GBB)** + card na conta + modal de upgrade | Preço/Design | 🟠 Alto | M | P1 |
| 10 | **Corrigir acessibilidade** (foco, alvos 44px, contraste, tabular-nums) | Design | 🟡 Médio | M | P1 |
| 11 | **Arquivar catálogo legado** e criar linha `creator_*` na AbacatePay | Preço | 🟡 Médio | S | P1 |
| 12 | **Painel de ROI do creator** + celebração de ativação | Produto/Design | 🟡 Médio | M | P2 |

> **Se você fizer só uma coisa:** corrija a sessão e o onboarding (#1, #5). É a mudança mais barata com o maior efeito sobre retenção — hoje o produto perde o usuário antes de ele voltar. **A segunda:** instrumentar (#2), porque sem medir nada todo o resto é hipótese.

---

# PARTE I — Produto & Funil (Revenue-Centric Design)

## 1.1 O que a plataforma é hoje

A TemTrend é um **assistente de produção de conteúdo para afiliados do TikTok Shop**: o usuário busca num catálogo curado, uma IA seleciona produtos reais (preço, comissão, vendas) e gera um **"plano de gravação"** (hook, cenas, roteiro, legenda, CTA, hashtags, áudio, duração). O usuário **grava e publica fora da plataforma** e acompanha o progresso num pipeline de 4 estágios: `salvo → em_producao → gravado → publicado`. Não é marketplace, não processa pagamento de vendas e não publica vídeos (`frontend/app/termos/page.tsx`).

**Evidências-chave do estado atual:**

- Plano único e gratuito, literal no backend: `plan: { nome: 'Plano gratuito', status: 'ativo', billing: false }` (`backend/src/modules/account/account.routes.ts:35`).
- Nenhum provedor de pagamento; nenhuma tabela `plans`/`subscriptions`/`credits` (a tabela `credit_transactions` foi **removida** em `backend/supabase/migrations/006_beta_cleanup_and_security.sql`).
- Limites existentes são guardas de custo de IA **invisíveis ao usuário**: 100 buscas/dia, 30 kits/dia, cooldown de 30s (`backend/src/lib/ai-metrics.ts:23-27`).
- Sem analytics, sem eventos, sem A/B em lugar nenhum.
- Sessão **só em memória** (`frontend/lib/supabase.ts:30-33`).

## 1.2 Aderência ao "spine" do Revenue-Centric Design

| # | Princípio (spine) | Status na TemTrend |
|---|---|---|
| 1 | Neutrality is omission | 🟡 Parcial — empty states e próximas ações são diretivos; a landing trata o resultado de forma neutra |
| 2 | Who talks to everyone convinces no one | 🔴 ICP implícito e amplo |
| 3 | Value first, ask later | 🔴 Valor inteiramente atrás de cadastro + e-mail + onboarding |
| 4 | Your promise is the size of your proof | 🔴 Zero prova (sem depoimentos, números ou prints reais) |
| 5 | Same competes on price, different on category | 🟡 Categoria não nomeada/diferenciada |
| 6 | Default is the decision you made for the user | 🟢 Razoável — onboarding tem default e atalhos "Para você" |
| 7 | Retention is built, not requested | 🟡 Pipeline é bom, mas sessão em memória + progresso local sabotam |
| 8 | Expansion is born of usage | 🔴 Não existe caminho de expansão (sem plano pago) |
| 9 | Price is a filter | 🔴 Não existe preço |

**Leitura:** a TemTrend acertou a parte mais difícil — o **mecanismo** (produto ativo, loop claro, estados vazios). Falta a camada de **prova, preço e persistência**.

## 1.3 Diagnóstico por etapa

### Aquisição — Landing
O que existe: hero com busca ("O que você quer vender?", CTA "Encontrar produtos"), "como funciona", showcase do plano (8 partes), exemplos de produto (assumidamente não reais), carrossel e FAQ (`frontend/app/landing-rebuild.tsx`, `frontend/app/landing-hero.tsx`).

Problemas e movimentos:
1. **Zero prova social.** Nenhum depoimento, contagem, nota ou creator real; só acervo rotulado ("Vídeo de acervo · Pexels", `creator-carousel.tsx:125`). *Princípio:* "Real humans outconvert models" — fotos de clientes reais venceram banco de imagem (+102,5%) [@richardrx · 2025-11-04]; "Aim for 4.2–4.5 stars" [@richardrx · 2026-05-14]. *Movimento:* 3 depoimentos verificáveis, número real de planos gerados, prints reais do produto.
2. **Copy não promete resultado.** H1 "Descubra o que vale a pena vender." descreve a função, não o *para quem* + *resultado*. Falha no teste dos 5 segundos. *Princípio:* "Specificity is the difference between decoration and persuasion" (30 LPs BR: 0,5% → 3%) [@richardrx · 2026-04-17]; "Pass the 5-second test" [@richardrx · 2026-05-01]. *Movimento:* hero *para quem → resultado → prova*.
3. **CTA responde zero das três perguntas.** "Começar agora" não diz o que acontece, quanto demora nem o custo. *Princípio:* "Write the CTA microcopy, not the button color" [@richardrx · 2026-05-25]. *Movimento:* "Começar grátis" + "Sem cartão. Seu primeiro plano de gravação em 2 minutos."
4. **O valor real está atrás do login.** A landing diz que os produtos são "exemplos visuais" e que as oportunidades "aparecem na plataforma" (`landing-rebuild.tsx:105`). O maior ativo (catálogo real + um plano completo) fica invisível. *Princípio:* "Value first, ask later"; "Show-don't-explain visual" [@richardrx · 2026-05-29]. *Movimento:* mostrar **um plano completo real** (blur no fim) e/ou permitir 1 busca real antes do cadastro.
5. **Cliques de saída não controlados.** O carrossel linka para o Pexels (`creator-carousel.tsx:123-126`). Remover links externos.
6. **Código morto.** `frontend/lib/landing-data.ts` ainda define `problems`, `transformation`, `profiles`, `products`, `workflow`, `benefits` — nada disso é usado pela landing viva. Parece uma seção de público/prova abandonada. *Movimento:* finalizar (é exatamente o que falta) ou apagar.
7. **Risco de performance.** "Performance is conversion" (Vodafone: LCP 31% melhor → +8% vendas) [@richardrx · 2026-08-04]. A landing usa PNGs gerados pesados (`frontend/public/hero-creators-reference.png`, `product-still-life.png`, ambos 1536×1024, o primeiro como `priority`). Auditar LCP/peso.

### Cadastro e formulários
O que existe: Nome + Email + Senha (mín. 6) ou social, aviso legal (`frontend/components/platform/Auth.tsx:342-375`).

1. **Confirmação de e-mail é portão rígido, sem reenvio** (`Auth.tsx:224`, `:181`) — usuário é jogado de volta ao login sem botão de reenviar nem status. *Princípio:* "Friction kills conversion… perceived effort ≠ real effort" [@richardrx · 2026-08-12]; "You lose money on the boring screens" [@richardrx · 2025-12-23]. *Movimento:* permitir sessão antes da confirmação (soft gate) **ou** adicionar reenvio + status.
2. **Campo "Nome" é fricção administrativa.** Dado usado só depois (saudação). *Princípio:* "Qualify by behavior, not by a long signup form" (8 campos → 12% vs e-mail+senha → 34%) [@richardrx · 2026-04-10]; "Add declarative friction, cut administrative friction" [@richardrx · 2026-05-07]. *Movimento:* pedir no onboarding ou derivar do e-mail.

### Ativação e onboarding
O que existe: 5 passos (Objetivo / Estilos / Temas / Voz / Pronto), passo 1 obrigatório, 2–4 puláveis (`Onboarding.tsx`).

1. **🔴 Sessão só em memória** (`supabase.ts:30-33`). Recarregar desloga e o gate `RequireAuth` reconduz ao onboarding — o UI já tenta compensar (`Auth.tsx:181`, "o navegador ainda não salvou a sessão…"). *Princípio:* "Map the whole journey to value — fix the biggest drop" [@richardrx · 2026-07-08]; "Rising MRR with rising churn means you lost them on day one" [@richardrx · 2026-06-18]. *Movimento:* persistência real de sessão (localStorage/cookies + refresh token). **Maior ROI do produto, custo S.**
2. **Progresso do onboarding não salva por passo** (`Onboarding.tsx:29-33`) — refresh recomeça do zero. *Movimento:* salvar cada passo e **começar a barra em >0%** (started-progress) — "start the bar at 20%, not 0%" [@richardrx · 2026-05-12].
3. **Entrega valor só depois de 5 passos.** O "aha" é ver um plano pronto. *Princípio:* "Deliver the promised result before teaching mechanics" [@richardrx · 2026-04-16]; "Make onboarding active, not passive" [@richardrx · 2026-04-22]. *Movimento:* logo após "Objetivo", gerar um plano de exemplo.
4. **Sem celebração de ativação.** O passo "Pronto" só navega para `/app/producao`. *Princípio:* "Celebrate the activation moment, don't just confirm it" [@richardrx · 2026-04-04].

### Núcleo do produto e retenção
O que está bom: busca com IA e fallback, cards com métricas, geração de kit, guia cena a cena com progresso, pipeline de 4 estágios, "Continue de onde parou".

1. **Progresso do guia só em `localStorage`** (`frontend/lib/guide-progress.ts`), apagado no signOut (`store.tsx:266-267`). Sem persistência de servidor, o "cofre" não é durável e o switching cost é fraco. *Princípio:* "Switching cost is what turns months of LTV into years" [@richardrx · 2026-06-23]; "Retention is raising the cost of leaving day after day" [@richardrx · 2026-03-27]. *Movimento:* persistir progresso de cena no servidor; histórico de kits/publicações = ativo.
2. **"Publicado" é autodeclarado** (`Production.tsx:304` permite marcar sem link) — infla a única métrica de resultado. *Movimento:* exigir/validar o link do TikTok e usar para provar valor.
3. **Falta painel de ROI do usuário.** O único dashboard é o admin. *Princípio:* "Missing perceived value → show user ROI in a simple dashboard" [@richardrx · 2025-12-17]; variable rewards [@richardrx · 2026-01-30]. *Movimento:* "você publicou N esta semana", streak, % vs. semana anterior.
4. **Primeiro acesso à Produção poderia vender o sonho** com sample data. "Never ship a blank dashboard" [@richardrx · 2026-05-12].
5. **Fallback de IA sem explicação** (`ContentKitDialog.tsx:90` salva "roteiro base") — dívida de expectativa. *Princípio:* "Churn starts on the landing page" [@richardrx · 2026-04-29].

### Monetização, posicionamento e métricas
→ Desenvolvidos nas **Partes II** (preço) e **III** (design). Resumo de produto:

- **Posicionamento/ICP:** a copy fala com "quem quer vender no TikTok" de forma ampla. *Princípio:* "Pick a deliberately under-served niche as your ICP" [@richardrx · 2026-05-19]. *Movimento:* nomear o ICP no hero.
- **Categoria:** risco de parecer "mais um app de IA que gera roteiro". *Princípio:* spine #5 + "Competing on price is adverse selection" [@richardrx · 2026-06-03]. *Movimento:* nomear o mecanismo próprio (parte do produto real com comissão, não de tema genérico).
- **Métricas:** instrumentar `signup`, `email_confirmed`, `onboarding_completed`, `first_search`, `first_kit_created`, `first_scene_recorded`, `first_published`. *Princípio:* "Measure activation, not signups" (TTV médio 1d12h; top <5min; boa ativação 30–37%) [@richardrx · 2026-05-27]; "Don't mistake signups for traction" [@richardrx · 2026-06-11]. Traduzir churn em LTV [@richardrx · 2026-04-06]. Não fazer A/B sem volume [@richardrx · 2026-06-01].

### Backlog de produto
| Prio | Item | Onde | Esforço |
|---|---|---|---|
| P0 | Persistir sessão | `frontend/lib/supabase.ts` | S |
| P0 | Persistir progresso do onboarding + barra >0% | `Onboarding.tsx` | S |
| P0 | Instrumentar eventos de ativação e TTV | frontend + backend | M |
| P1 | Soft-gate de e-mail + reenvio | `Auth.tsx` | S |
| P1 | Prova social real + copy de resultado | `landing-*.tsx` | M |
| P1 | Ver o produto antes do signup (kit de exemplo) | landing | M |
| P1 | Exigir/validar link do TikTok para "publicado" | `Production.tsx` | S |
| P2 | Persistir progresso de gravação no servidor | `guide-progress.ts` + backend | M |
| P2 | Painel de ROI + streak | novo | M |
| P2 | Sample data no 1º acesso à Produção | `Production.tsx` | S |
| P2 | Limpar código morto da landing | `lib/landing-data.ts` | S |
| P2 | Remover links externos (Pexels) | `creator-carousel.tsx` | S |

---

# PARTE II — Precificação & Monetização

> **Nota de verificação.** O catálogo da loja TemTrend.AI na AbacatePay foi consultado via API em 18/10/2026 e confirma **11 produtos ativos** (idênticos ao estudo v1). O valor de plano fixo (`account.routes.ts:35`), a ausência de billing e os limites de IA (`ai-metrics.ts:23-27`) foram confirmados no código. Números de custo/imposto são premissas a validar com o contador.

**Premissa central:** **100% da primeira receita é reinvestida na própria plataforma** (infra, IA, aquisição e reserva).

## 2.1 Sumário executivo

A TemTrend já tem produto pronto para cobrar. O custo marginal por usuário é baixo (IA ≈ R$ 0,03 por roteiro; infra enxuta ≈ R$ 41/mês), o que permite preço de entrada acessível com margem alta. O risco não é custo — é **posicionamento e catálogo**: a loja tem 11 produtos legados, duplicados e de outra fase (marketplace).

**Recomendação em uma tabela**

| Plano | Mensal | Anual | Papel na escada |
|---|---|---|---|
| Essencial | R$ 29,90 | R$ 299 | Isca/entrada (decoy) |
| **Pro** | **R$ 59,90** | **R$ 599** | Plano-alvo (~50% dos clientes) |
| Scale | R$ 149 | R$ 1.490 | Âncora para agências/duplas |
| Enterprise | R$ 499+ | sob consulta | Âncora de preço |
| Avulso (experimento) | R$ 19,90 / 10 kits | — | Decoy que empurra a assinatura |

- **Trial:** 7 dias de Pro sem cartão; ao fim, amostra gratuita de 3 kits (não um plano free permanente).
- **Break-even:** 6 assinantes no modo "sério" (infra paga) ou 1 no modo enxuto. Com pró-labore de R$ 3.000: ~57 assinantes.
- **Margem de contribuição:** ~89–90% em qualquer cenário acima de 50 assinantes.
- **Primeira ação:** limpar o catálogo da AbacatePay, criar a linha "TemTrend Creator" e implementar billing + gating por plano.

## 2.2 Inventário completo

### Jornada do criador
| Etapa | O que o usuário faz | O que a plataforma entrega |
|---|---|---|
| Landing | Busca um produto ou clica em "Não sei o que vender" | Hero com busca, exemplos, "como funciona", as 8 partes do plano, carrossel, FAQ. A busca sobrevive ao login |
| Cadastro/login | Email/senha ou Google/Facebook/Apple | Conta grátis, recuperação de senha. Sessão só em memória (login a cada visita) |
| Onboarding (5 etapas) | Objetivo, estilos, temas, "sua voz" (opcional) | Personalização que alimenta a IA: temas entram na busca; a voz entra no roteiro |
| Descobrir | Descreve o que quer vender | IA devolve até 5 produtos reais com motivo, preço, comissão em R$, vendas e badges. Filtro de categorias sensíveis |
| Kit de conteúdo | Escolhe 5 direções prontas ou escreve briefing | Plano em 8 partes: conceito, hook, cenas (3–8), roteiro, legenda, CTA, hashtags, áudio/duração — 3 variações de hook, versão sem aparecer, dica de publicação, 5 variações de roteiro |
| Guia de gravação | Marca cena a cena o que já gravou | Checklist "antes de gravar", escolha de hook, "Mostre / Fale / Ação" por cena, progresso, cópia por etapa ou do plano inteiro |
| Minha produção | Acompanha o funil | Status salvo → em produção → gravado → publicado, filtros, busca, ordenação por próxima ação, progresso (2/4), link do vídeo (opcional) |
| Conta | Edita perfil, preferências, voz, senha | "Sua voz" (até 500 caracteres) personaliza todos os roteiros; exclusão de conta; plano atual (fixo em "gratuito") |
| Admin (interno) | Opera catálogo e comunidade | Dashboard (creators, produtos, kits, publicações, uso de IA), CRUD de produtos, upload, gestão de kits, bloqueio/reativação, export CSV |

### O que a IA faz (e custa)
| Operação | Entrada | Saída | Custo estimado* |
|---|---|---|---|
| Busca de produtos (`POST /assistant/products`) | ~1.200 tokens | ≤400 tokens | ≈ R$ 0,005 |
| Geração de kit (`POST /products/:id/content-kit`) | ~1.500–2.500 tokens (com retries) | ≤3.000 tokens | ≈ R$ 0,03 |

\* Gemini 3.1 Flash-Lite: US$ 0,25/1M entrada e US$ 1,50/1M saída; câmbio R$ 5,40. Há fallback para OpenRouter (modelo free) e fallback determinístico — o custo pode ser menor.

### Limites que já existem (hoje iguais para todos)
- 100 buscas de IA/dia e 30 kits/dia por usuário, cooldown de 30s (`backend/src/lib/ai-metrics.ts:23-27`).
- Rate limits técnicos: 10 buscas/min, 5 kits/min, 200 req/min global.
- Cota persistida em `ai_usage_daily` e métricas de tokens no admin — a base para limite por plano **já está pronta**.

### O que a TemTrend NÃO oferece (hoje)
Não publica automaticamente, não edita vídeo, não garante vendas, não tem analytics de views/receita do creator, não integra afiliados, não tem multiusuário/assentos, não exporta dados. **Implicação de preço:** não vender o que não existe; usar isso como **roadmap de upgrade** (upsell futuro), não como promessa atual.

## 2.3 Estrutura de custos

### Infraestrutura fixa
| Item | Hoje | Recomendado ao cobrar | Custo/mês |
|---|---|---|---|
| Render (API) | Free (cold start 30–60s) | Starter US$ 7 | R$ 37,80 |
| Vercel (frontend) | Hobby | Pro US$ 20 (obrigatório p/ uso comercial) | R$ 108,00 |
| Supabase (banco/auth/storage) | Free | Pro US$ 25 (backup diário, sem pausa) | R$ 135,00 |
| Domínio | ~R$ 40/ano | idem | R$ 3,33 |
| E-mail transacional | Resend free | free até 3k/mês | R$ 0 |
| **Modo enxuto** | | Render Starter + Vercel Hobby + Supabase Free | **≈ R$ 41/mês** |
| **Modo sério** | | Render Starter + Vercel Pro + Supabase Pro | **≈ R$ 284/mês** |

O cold start do Render Free já causou lentidão real no login. Antes de cobrar, o Starter (US$ 7) é obrigatório — é o upgrade com maior retorno por real.

### Taxas da AbacatePay
| Método | Taxa | Em R$ 29,90 | Em R$ 59,90 | Em R$ 149 |
|---|---|---|---|---|
| PIX | R$ 0,80 fixo | 2,7% | 1,3% | 0,5% |
| Cartão | 3,5% + R$ 0,60 | 5,5% | 4,5% | 3,9% |
| Boleto | R$ 2,50 | 8,4% | 4,2% | 1,7% |

**Implicação:** PIX deve ser o padrão. Anual no PIX é o melhor negócio para a plataforma: receita adiantada, taxa de R$ 0,80 única e churn praticamente zero por 12 meses.

### Impostos (premissa)
Simples Nacional Anexo III (serviços): alíquota inicial de 6% sobre a receita bruta. **Confirmar com contador** (a empresa é LTDA/EPP; ISS e faixa podem variar). Reservar o imposto desde o primeiro real.

### Receita líquida por plano (após taxa PIX + 6% de imposto)
| Plano | Bruto | Taxa PIX | Imposto | Líquido | % |
|---|---|---|---|---|---|
| Essencial | 29,90 | 0,80 | 1,79 | 27,31 | 91,3% |
| Pro | 59,90 | 0,80 | 3,59 | 55,51 | 92,7% |
| Scale | 149,00 | 0,80 | 8,94 | 139,26 | 93,5% |

No cartão, o líquido cai ~R$ 1–6 por cobrança (ex.: Pro = R$ 53,61) — reforça o incentivo ao PIX/anual.

### Custo de IA por perfil de uso (mensal)
| Perfil | Buscas/mês | Kits/mês | Custo IA |
|---|---|---|---|
| Leve | 10 | 5 | R$ 0,20 |
| Médio | 60 | 20 | R$ 0,90 |
| Pesado (teto atual) | 3.000 | 900 | R$ 42,00 |

O usuário médio custa menos de R$ 1/mês. O usuário-pesado pode consumir um plano Essencial inteiro. Os planos precisam de **teto mensal de kits** — não pelo usuário típico, mas para proteger a margem de quem abusa.

## 2.4 Auditoria do catálogo atual na AbacatePay (verificada via API)

| Produto | Preço | Ciclo | Diagnóstico |
|---|---|---|---|
| 2 Campanhas Avulsas | R$ 49,99 | único | Legado de marketplace |
| 1 Campanha Avulsa | R$ 29,99 | único | Legado de marketplace |
| Scale | R$ 499,00 | mensal | Legado — 3,3× o recomendado |
| Pro | R$ 178,00 | mensal | Legado — 3× o recomendado |
| Essencial | R$ 96,00 | mensal | Legado — 3,2× o recomendado |
| TemTrend Enterprise | R$ 699,00 | mensal | Reaproveitável como âncora |
| TemTrend Pro | R$ 199,00 | mensal | Legado — substituir |
| TrendPulse PRO | R$ 19,90 | único | Duplicata |
| TrendPulse PRO | R$ 19,90 | único | Duplicata |
| TrendPulse PRO | R$ 1,99 | único | Preço de teste |
| Modo PRO - TemTren.AI | R$ 19,90 | único | Nome com typo, legado |

**Recomendação:** não excluir o histórico; **pausar/arquivar** os legados e criar uma linha nova com `externalId` claro (`creator_essencial_monthly`, `creator_pro_monthly`, `creator_scale_monthly`, versões `_yearly`, `creator_kits_10`). Nomes: TemTrend Essencial / Pro / Scale / Enterprise. Sem isso, o cliente vê ofertas conflitantes e a cobrança nasce confusa.

## 2.5 Valor percebido e âncoras

**O que o cliente ganha (proxy de valor, sem prometer vendas):**
- **Tempo:** 1–2h por produto (pesquisa + roteiro + plano). 30 kits/mês = 30–60h. A R$ 25/h → R$ 750–1.500/mês de valor.
- **Comissão:** catálogo com produtos de R$ 30–150 e comissões ~10–25% → R$ 3–37 por venda. 3–5 vendas extras pagam o Essencial.
- **Redução de erro:** evita gravar sem plano, escolher produto ruim e publicar sem CTA.

**Âncoras de comparação**

| Alternativa | Custo típico |
|---|---|
| Agência/gestor de conteúdo | R$ 300–1.000/mês |
| Curso de TikTok Shop | R$ 200–500 (único, sem ferramenta) |
| Freelancer de roteiro | R$ 50–150 por roteiro |
| **TemTrend Pro** | **R$ 59,90/mês (≈ R$ 2/dia)** |

O Pro é ~5–10% de uma agência e menos que 1 roteiro de freelancer. Essa é a moldura de comparação — **nunca comparar com "grátis"**.

## 2.6 Estratégia de precificação (racional)

- **GBB (Good-Better-Best):** três planos visíveis + Enterprise como âncora. O Essencial é a isca: limite que dói (sem voz personalizada, sem "gerar outra versão") faz o Pro parecer óbvio por +R$ 30. *Princípios:* "Engineer the pricing page with GBB" [@richardrx · 2026-02-03]; "Engineer the comparison frame with a decoy and a high anchor" [@richardrx · 2026-04-14]; "Frame the upgrade as a loss at the moment of value" (sunk cost: "você criou 47 roteiros; no gratuito perde acesso a 40") [@richardrx · 2026-04-21].
- **Sem plano gratuito permanente:** free ancora o preço em zero e destrói a percepção de valor. No lugar: trial de 7 dias + amostra de 3 kits. *Princípio:* "Whether freemium works is decided by the cost to serve a free user" — "For an AI product, your free user was never free." [@richardrx · 2026-06-30]; "The freemium trap, in numbers" (8% signup vs 3% direto: R$ 6.368 vs R$ 59.700 MRR no mesmo tráfego) [@richardrx · 2026-07-01]; "Charge your first ten users from day one" [@richardrx · 2026-04-26].
- **Uma única escada de valor:** volume de kits/mês (30 → 100 → 300 → fair use). Não misturar tokens com suporte na mesma comparação.
- **Anual com desconto de 2 meses:** melhora caixa, reduz churn e a taxa PIX cai para centavos.
- **Preço como filtro:** não descer de R$ 29,90. Preço baixo atrai comprador não comprometido e aumenta churn. *Princípio:* spine #9 "Price is a filter".
- **Reajuste:** só com valor novo entregue (analytics, assentos, exportação), nunca "aumento seco". Testar preço novo apenas em clientes novos.

## 2.7 Planos recomendados

### Matriz de recursos
| Recurso | Amostra grátis | Essencial R$ 29,90 | Pro R$ 59,90 | Scale R$ 149 | Enterprise R$ 499+ |
|---|---|---|---|---|---|
| Kits de conteúdo/mês | 3 (total) | 30 | 100 | 300 | fair use (1.000) |
| Buscas de IA/dia | 10 | 50 | 200 | 500 | ilimitado fair use |
| Variações / "gerar outra versão" | não | sim (60s) | sim (30s) | sim (30s) | sim |
| Voz personalizada no roteiro | não | sim | sim | sim | sim |
| Roteiros salvos por produto | 1 | 5 | ilimitado | ilimitado | ilimitado |
| Guia de gravação + produção | sim (5 itens) | sim (50) | ilimitado | ilimitado | ilimitado |
| Histórico completo | não | sim | sim | sim | sim |
| Assentos | 1 | 1 | 1 | 3 | 10+ |
| Exportação CSV | não | não | sim* | sim* | sim* |
| Suporte | comunidade | e-mail 48h | prioritário 24h | dedicado | SLA |
| Onboarding assistido | não | não | não | sim* | sim* |

\* Itens a construir. Os demais **já existem no código** e podem ser limitados por plano imediatamente.

### Preços e papéis
| Plano | Mensal | Anual (2 meses grátis) | Equivalente mensal | Público | Papel |
|---|---|---|---|---|---|
| Essencial | R$ 29,90 | R$ 299 | R$ 24,92 | Creator iniciante | Decoy: limita voz e variações |
| **Pro** | **R$ 59,90** | **R$ 599** | **R$ 49,92** | Creator ativo (foco) | Alvo: ~50% da base |
| Scale | R$ 149 | R$ 1.490 | R$ 124,17 | Duplas e agências | Âncora + volume/assentos |
| Enterprise | R$ 499+ | sob consulta | — | Operações maiores | Âncora de preço |
| Avulso | R$ 19,90 (10 kits) | — | — | Quem não quer assinar | Decoy: 10 kits vs 30/mês + features |

Preço por kit percebido: Essencial R$ 1,00 · Pro R$ 0,60 · Scale R$ 0,50 — escada linear e fácil de explicar.

### Trial
- 7 dias de Pro, **sem cartão**, com onboarding completo (o "aha" é o primeiro kit pronto + guia).
- E-mails: dia 0 (boas-vindas), dia 2 (primeiro kit), dia 5 (o que você já criou), dia 7 (fim do trial + oferta anual).
- Ao expirar: cai para a amostra de 3 kits, **sem apagar nada**. O histórico fica visível, bloqueado para novos roteiros — perda percebida no momento certo.
- Não pedir cartão no trial nesta fase: preço baixo e público BR responde melhor a PIX. Medir conversão; se < 10%, testar trial com cartão no Pro. *Princípios:* "Ask for the card in trial — but optimize for the right ICP" [@richardrx · 2026-05-15]; "Tie the trial's end to value consumed, not the calendar" [@richardrx · 2026-03-16].

## 2.8 Unit economics

**Premissas:** mix 35% Essencial / 50% Pro / 15% Scale → ARPU R$ 62,77; receita líquida média R$ 58,20/assinante/mês; IA média R$ 0,90; churn base 8%/mês (12,5 meses de vida); CAC orgânico ≈ R$ 0; CAC pago hipótese R$ 100.

| Assinantes | MRR | Receita líquida | Custos fixos | IA | Outros | Contribuição | Margem |
|---|---|---|---|---|---|---|---|
| 20 | R$ 1.255 | R$ 1.164 | R$ 41 (enxuto) | R$ 18 | — | R$ 1.105 | 88% |
| 50 | R$ 3.139 | R$ 2.910 | R$ 41 | R$ 45 | — | R$ 2.824 | 90% |
| 200 | R$ 12.554 | R$ 11.640 | R$ 284 (sério) | R$ 180 | — | R$ 11.176 | 89% |
| 1.000 | R$ 62.770 | R$ 58.200 | R$ 800 | R$ 900 | R$ 700 | R$ 55.800 | 89% |

**Break-even:** enxuto = 1 assinante; sério = 5–6; com pró-labore R$ 3.000 = ~57.
**LTV/CAC:** LTV (churn 8%) = R$ 727; (churn 12%) = R$ 485. CAC R$ 100 → payback 1,7 mês; LTV/CAC 4,8–7,3×. **Regra de saúde:** payback < 3 meses e LTV/CAC > 3×.
**Sensibilidade:** Pro de R$ 59,90 → R$ 79,90 (+33%) com 20% de churn ainda eleva ~25% a receita líquida por cliente remanescente. Preço é a alavanca mais barata.

## 2.9 Regra do caixa: "primeiro dinheiro 100% para a plataforma"

| Fase | MRR | Alocação |
|---|---|---|
| 0 — fundação | até R$ 1.000 | 100% reinvestido: Render Starter (mata cold start), Supabase Pro, domínio, reserva de impostos, primeiros testes de anúncio |
| 1 — tração | R$ 1.000–5.000 | 40% growth · 30% infra/IA · 20% reserva · 10% impostos |
| 2 — escala | acima de R$ 5.000 | 30% growth · 20% infra · 30% reserva (3 meses) · 20% produto/equipe |

**Regras:** imposto sai primeiro (reservar 6%); reserva mínima de 3 meses de custo fixo antes de qualquer retirada; nada de retirada antes de R$ 5.000 de MRR.
**Gatilhos de revisão de preço:** conversão trial→pago > 25%, churn < 5% por 3 meses, custo de IA > 10% da receita líquida, ou fila de suporte > 48h.

## 2.10 Riscos e mitigação

| Risco | Impacto | Mitigação |
|---|---|---|
| Catálogo AbacatePay legado/duplicado | Cliente confuso, cobrança errada | Arquivar legados; criar linha `creator_*` |
| Não existe billing no código | Nenhuma receita | Plano de dados, checkout, webhook e gating (roadmap) |
| Cold start do Render Free | Perda de conversão no login | Subir para Starter antes de cobrar |
| Usuário-pesado de IA | Consome o ticket inteiro | Teto mensal de kits por plano; fair use nas buscas |
| Churn do PIX recorrente | Receita instável | Empurrar anual no PIX; trial sem cartão; lembretes de valor |
| Trial abuse | Custo e suporte | Limite de 1 trial por conta/CPF; amostra limitada |
| Webhook não verificado | Fraude/ativação indevida | Validar assinatura e idempotência |
| Chave de produção em testes | Cobranças reais | Chave dev/teste local; produção só no Render |
| Expectativa de "vender sozinho" | Reembolso e churn | Copy honesta: a plataforma planeja e organiza, não garante vendas |
| Impostos | Multa | Reservar 6% desde o dia 1 e validar com contador |

---

# PARTE III — Design & Interface

Esta parte cruza o `DESIGN.md` (fonte de verdade documentada), os estilos reais e as diretrizes de interface.

## 3.1 O que está bom (não regredir)

Vale registrar os acertos, porque o redesign deve **melhorar sem quebrar**:

- **Tipografia com personalidade.** Manrope (interface) + Instrument Serif itálica (acento editorial) fogem do "Inter everywhere" — é exatamente o que o guia de taste recomenda (`frontend/app/layout.tsx:26-36`).
- **Identidade de cor forte.** Lima `#c8ff2e` como única cor de marca, com hierarquia clara de tinta/superfície (`DESIGN.md:11-24`).
- **Navegação mobile bem resolvida.** Bottom nav em pill com `env(safe-area-inset-bottom)` (`platform-theme.css:1115-1131`).
- **Acessibilidade acima da média.** Skip link (`page.tsx:14`), `aria-live`/`role="status"` em quase todo estado assíncrono, `aria-label` em ícones, alt em imagens, `prefers-reduced-motion` tratado (`landing.css:5`, `platform-theme.css:1165-1172`).
- **Formatação local correta.** `Intl.NumberFormat`/`DateTimeFormat` em pt-BR (`Admin.tsx:99-101`, `Assistant.tsx:31`, `lib/format.ts:19`) — sem números hardcoded.
- **Sem zoom bloqueado.** Não há `user-scalable=no`/`maximum-scale`.
- **Estados vazios com saída clara** e mensagens que tranquilizam ("Seus conteúdos continuam salvos…", `Production.tsx:167`).

## 3.2 🔴 Sistema de design: o documentado ≠ o implementado

O `DESIGN.md` define uma paleta; o CSS implementa outra. **6 de 10 cores divergem:**

| Papel | `DESIGN.md` | Implementado no CSS | Status |
|---|---|---|---|
| Tinta | `#10110f` | `--tt-ink: #10110f` (mas `design-system.css:16` diz `#080808`) | ⚠️ parcial |
| Lima | `#c8ff2e` | `--tt-lime: #c8ff2e` | ✅ |
| Lima claro | `#f2ffcb` | `--tt-lime-soft: #f2ffcb` | ✅ |
| Verde profundo | `#385400` | `--tt-lime-deep: #82af00` | ✗ |
| Papel | `#fbfcf8` | fundos `#fff` / `#fafff0` | ✗ |
| Superfície suave | `#f4f6ef` | `--tt-soft: #f4f4f1` | ✗ |
| Linha | `#dce3d3` | `--tt-line: #deded8` (e `#e2e8d9` nos cards) | ✗ |
| Texto secundário | `#4f574b` | `--tt-muted: #62665d` | ✗ |
| Erro | `#a52727` | `#a92340` / `#c43856` / `#d79aa7` | ✗ |

Além disso, há **cores não documentadas em uso** (`#c9f5ff`, `#e2e8d9`, `#90be28`, `#eaffba`, `#14713f`, `#8fd9b1`, `#e9f8ef`) e **resíduos da marca TikTok** ainda ativos: `frontend/styles/styles.css:1` define `:root{font-family:Inter…}` e `--cyan:#25f4ee; --pink:#fe2c55`, e `.auth-view:before/:after` desenha as barras TikTok (`styles.css:4`); `landing-refinements.css:1` usa `#25f4ee` (ciano TikTok) como outline de foco.

> **Movimento:** escolher **uma** fonte de verdade. Recomendo adotar a paleta do `DESIGN.md` (é a mais intencional: `#385400` como verde profundo, `#dce3d3` como linha, `#4f574b` como secundário) e propagá-la aos tokens. Remover Inter/TikTok e cores ad-hoc. Documentar novos papéis (verde de sucesso, azul informativo) no `DESIGN.md`.

## 3.3 🔴 Arquitetura CSS: 22 arquivos globais, camadas concorrentes

**22 arquivos CSS, 366 KB, ~7.300 linhas**, todos globais, importados em cascata (`frontend/app/layout.tsx:3-24`). A nomenclatura denuncia o padrão de correção incremental em vez de sistema:

`landing.css` → `landing-refinements.css` → `landing-fixes.css` → `landing-polish.css` → `landing-experience.css` → `landing-reference.css` → `landing-refine.css` → `landing-rebuild.css` → `ux-overhaul.css` → `platform-redesign.css` → `platform-theme.css` → `design-system.css`.

**O sintoma mais grave:** o próprio `design-system.css:3-4` diz *"este arquivo vem POR ÚLTIMO no layout, então vence conflitos"* — **mas não vem**: há 16 arquivos importados depois dele (`platform-theme`, `ux-overhaul`, `platform-redesign`, etc.). Ou seja, a estratégia de "último vence" está quebrada, e existem **pelo menos 4 definições concorrentes** de botão/card/input:
- `design-system.css:51-76` → botão `#000`, radius pill, altura 51px, weight 800.
- `platform-theme.css:266-304` → botão `var(--tt-ink)`, altura 51px, e `button-small` de **38px**.
- `ux-overhaul.css` e `platform-redesign.css` → mais overrides.

Isso explica inconsistências visíveis (raios, pesos, alturas) e torna cada mudança arriscada.

> **Movimento:** consolidar numa arquitetura em camadas — `tokens.css` (variáveis) → `base.css` (reset, tipografia) → `components.css` (botões, inputs, cards, pills, dialog) → `pages/*.css` — e **deletar** os arquivos "fix/polish/refine". Usar `@layer` para ordem explícita em vez de depender da ordem de import. Mover `legacy-static/` para fora do app.

## 3.4 🔴 Acessibilidade e interface (achados por `arquivo:linha`)

| Severidade | Achado | Evidência |
|---|---|---|
| 🔴 | **Foco inconsistente e às vezes invisível.** 8+ cores de outline diferentes, incluindo `#25f4ee` (ciano TikTok) e **lima `#c8ff2e` sobre fundo branco** (contraste ~1.3:1 → falha o mínimo de 3:1 para indicador de foco) | `landing-refinements.css:1`; `landing-rebuild.css:142,181`; `landing-navbar.css:17-20`; `platform-theme.css:433-438` (`#90be2855`); `ux-overhaul.css:269` (`#385400` ✅) |
| 🔴 | **A meta correta já existe** (`design-system.css:32-35`, `outline: 2px solid #385400`) mas é sobrescrita por regras posteriores | `design-system.css:32` vs `platform-theme.css:433` |
| 🟠 | **Alvos de toque < 44px** (o `DESIGN.md:39` exige 44px). `button-small` 38px, `dialog-close` 36px, `tt-btn-small` 38px, `kit-jump-nav a` 36px, `block-heading button` 34px | `platform-theme.css:298-304`; `design-system.css:292-300,869` |
| 🟠 | **Tipografia abaixo do mínimo documentado.** O `DESIGN.md:31` diz 0.75rem (12px) mínimo; há muitos 10–11px, vários em UPPERCASE com letter-spacing | `platform-theme.css:119-123` (10px); `design-system.css:369-377,479-486` (11px) |
| 🟠 | **Contraste abaixo de AA em textos secundários.** `#8a8d85` (~3.4:1) e `#888` usados em textos de 0.66–0.72rem | `design-system.css:678,914,924`; `platform-theme.css:750` |
| 🟡 | **`tabular-nums` quase ausente.** O `DESIGN.md:32` exige algarismos tabulares para preço/comissão/vendas/progresso, mas só 2 seletores aplicam | `ux-overhaul.css:261,268` |
| 🟡 | **Scroll suave global ignora `prefers-reduced-motion`.** `data-scroll-behavior="smooth"` no `<html>`; a regra de reduced-motion mira `.tt-home *`, não o elemento de scroll | `layout.tsx:49`; `landing.css:5` |
| 🟡 | **Smooth `transition` de cor de fundo pode piscar** em `backdrop-filter`; verificar perf em mobile | `platform-theme.css:193` |

**Movimentos:** (1) um único token de foco — `outline: 3px solid #385400; outline-offset: 3px` — aplicado globalmente e nunca sobrescrito; remover cores TikTok/lime de foco. (2) Padronizar alvos ≥ 44px (ou 48px no mobile). (3) Subir textos 10–11px para ≥ 12px, reservando maiúsculas apenas para eyebrows com contraste garantido. (4) Escurecer os cinzas de metadado para ≥ 4.5:1. (5) Aplicar `font-variant-numeric: tabular-nums` nos containers de métricas/progresso. (6) Trocar o scroll suave por `@media (prefers-reduced-motion: no-preference)`.

## 3.5 Landing: prova, affordance e promessa

1. **Faux affordances.** O hero tem botões de play decorativos sobre uma imagem estática (`page.tsx:50-51`, `.tt-hero-play ▷`) — parecem clicáveis e não são. Num produto sem prova social, isso corrói confiança. *Movimento:* substituir por **um screenshot real da plataforma** ou um vídeo-demo curto e real.
2. **Prova zero.** Ausência total de depoimento/número/print (ver Parte I). Este é o item de design de maior impacto na conversão.
3. **Promessa de venda.** A faixa de confiança termina em **"→ Venda"** (`page.tsx:55`), conflitando com o `DESIGN.md:55` ("não insinuar que a plataforma garante vendas") e com o FAQ ("Sem promessa de venda garantida", `landing-rebuild.tsx:134`). *Movimento:* trocar "Venda" por "Resultado"/"Publicação".
4. **Clique de saída.** Carrossel linka ao Pexels (`creator-carousel.tsx:123-126`) — remover.
5. **LCP/peso.** Dois PNGs 1536×1024, um como `priority` (`page.tsx:40-48`, `landing-rebuild.tsx:107`). Auditar e servir AVIF/WebP com dimensões explícitas.
6. **Rótulos honestos (bom).** "Exemplos ilustrativos" está presente (`landing-rebuild.tsx:105,108`).

## 3.6 Plataforma: hierarquia e novos painéis

- **Hierarquia de métricas boa** (cartão lima + cartão escuro no `production-overview`, `platform-theme.css:483-509`) — manter como linguagem.
- **Falta o painel de ROI do creator** (Parte I) e a **tela de celebração de ativação**.
- **Modais** seguem o sistema com `::backdrop` com blur (`platform-theme.css:987-998`) — bom; garantir `overscroll-behavior: contain` (`DESIGN.md`/guia).
- **Empty states** já existem; falta **sample data** no primeiro acesso.

## 3.7 Novas telas a desenhar (especificação)

### A) `/planos` — página de preços (GBB)
Estrutura recomendada, já no sistema visual:
1. **Hero enxuto:** eyebrow "Planos", H1 com Instrument Serif ("Comece **grátis**. Cresça quando fizer sentido."), sub com a moldura de comparação ("menos que 1 roteiro de freelancer").
2. **Toggle Mensal / Anual** (anual destacado, "2 meses grátis", badge lima) — âncora visual no anual via PIX.
3. **3 cartões GBB** (_Good_ Essencial, _Better_ **Pro** em destaque com borda lima e selo "Mais escolhido", _Best_ Scale) + **Enterprise** como faixa-âncora de preço. Cada cartão: preço grande em `tabular-nums`, equivalente mensal no anual, 5–6 bullets, CTA primário.
4. **Avulso** como _decoy_ discreto ("10 kits por R$ 19,90") ao lado dos planos.
5. **Comparação completa** (tabela da matriz de recursos) — colapsável no mobile.
6. **Prova + FAQ curto** (5 perguntas: cancelamento, PIX, meus roteiros ficam?, garantia, o que não está incluído).
7. **Rodapé de confiança:** "Sem cartão no trial · Cancele quando quiser · Seus kits continuam seus".
8. **Estado logado:** se já assina, a página vira "Meu plano" (upgrade/downgrade), nunca tela de venda repetida.

### B) Card "Meu plano" na Conta
Trocar o pill atual (`DESIGN.md`/`platform-theme.css:943-950`, hoje estático) por um cartão com: nome do plano, status, data de renovação, uso do mês (kits usados/teto, barra de progresso em `tabular-nums`) e CTA "Fazer upgrade". *Princípio:* mostrar o ROI/uso consumido é o gatilho natural de upgrade.

### C) Modal de upgrade no limite
Intercept no **momento do valor**, não por bloqueio abrupto: "Você já criou **30 de 30** roteiros no Essencial. No Pro são **100** — e você mantém tudo o que já fez." Botão primário "Ver o Pro (R$ 59,90)" + secundário "Continuar no Essencial". *Princípio:* aversão à perda + sunk cost.

### D) Dashboard do creator (retenção)
Faixa superior: streak de produção (chama + dias), "kits publicados na semana", variação vs. semana anterior, próximo passo sugerido. *Princípio:* variable rewards + "show user ROI".

### E) Tela de cancelamento
Antes de lançar plano, desenhar a última conversa: motivos (radial), oferta de retenção proporcional ao motivo, confirmação em 2 passos com resumo do que o usuário perde. *Princípio:* "Design the cancel screen — it's your last conversation" [@richardrx · 2026-05-13].

### F) Celebração de ativação
Após o 1º kit: gráfico/itens "subindo" + próximo passo, em vez de redirecionar seco para a Produção.

## 3.8 Movimento e micro-interações
- Padronizar duração (180–300ms) e **uma** curva de easing; hoje há `.18s`, `.2s`, `.25s` misturados.
- Adicionar confirmação de cópia ("Copiado ✓") nos botões do kit — hoje a cópia não dá feedback visível local.
- Botões: manter o `translateY(-2px)` no hover e `scale(.98)` no active (`design-system.css:78-87`) — bom.
- Garantir que animações de entrada **nunca condicionem a leitura** (o `DESIGN.md:50` já exige; verificar se há `opacity:0` inicial sem fallback no JS desabilitado).

## 3.9 Checklist de pré-lançamento visual

- [ ] Uma única fonte de tokens; `DESIGN.md` sincronizado com o código.
- [ ] `design-system.css` **de fato por último** (ou migrado para `@layer`).
- [ ] Foco único `#385400` em todos os elementos interativos; nenhum outline lime/ciano.
- [ ] Todos os alvos de toque ≥ 44px.
- [ ] Nenhum texto funcional < 12px; cinzas secundários ≥ 4.5:1.
- [ ] `tabular-nums` em preço/comissão/vendas/progresso.
- [ ] Scroll suave só sem `prefers-reduced-motion`.
- [ ] Hero sem faux affordance; provas reais (depoimento + número + print).
- [ ] Sem links externos de saída; sem promessa de venda.
- [ ] Autoplay: nenhum vídeo toca sozinho (hoje OK — manter).
- [ ] `overscroll-behavior: contain` em modais/drawers.

### Backlog de design
| Prio | Item | Onde | Esforço |
|---|---|---|---|
| P0 | Unificar tokens e sincronizar com `DESIGN.md` | `styles/*` | M |
| P0 | Consolidar CSS em camadas e remover arquivos "fix/polish" | `layout.tsx` + `styles/*` | M |
| P1 | Foco único `#385400`; remover cores TikTok/lime de foco | `styles/*` | S |
| P1 | Alvos ≥ 44px; textos ≥ 12px; contraste ≥ 4.5:1 | `styles/*` | M |
| P1 | `tabular-nums` global em métricas | `styles/*` | S |
| P1 | Landing: provas reais + remover faux play + fixar "→ Venda" | `page.tsx`, `landing-*.tsx` | M |
| P1 | Desenhar `/planos` (GBB) + card "Meu plano" + modal de upgrade | novo | M |
| P2 | Dashboard do creator + celebração de ativação | novo | M |
| P2 | Tela de cancelamento | novo | M |
| P2 | Auditar LCP/peso (AVIF/WebP) | `public/*` | S |
| P2 | Reduzir variantes de easing/duração | `styles/*` | S |

---

# PARTE IV — Roadmap unificado

Ordem recomendada: **medir → corrigir a base → provar → cobrar → expandir.**

| Fase | Foco | Entregas | Esforço |
|---|---|---|---|
| **0. Fundação** | Parar de vazar e medir | Persistir sessão; persistir onboarding (barra >0%); instrumentar funil (signup→published) + TTV; subir Render Starter; reservar 6% de imposto | 3–4 dias |
| **1. Confiança** | Converter visita em cadastro | Prova social real + copy de resultado no hero; kit de exemplo antes do signup; soft-gate de e-mail + reenviar; acessibilidade (foco, 44px, contraste, tabular-nums) | 5–7 dias |
| **2. Receita** | Cobrar | Arquivar catálogo legado + criar linha `creator_*`; migration `026_billing.sql`; módulo billing (checkout, webhook idempotente, gating, cotas por plano); `/planos` + card na conta + modal no limite; trial 7 dias + e-mails Resend | 8–10 dias |
| **3. Retenção & expansão** | Aumentar LTV | Persistir progresso no servidor; dashboard de ROI + streak; celebração de ativação; tela de cancelamento; programa de indicação; verificar link do TikTok em "publicado" | 6–8 dias |

**Estimativa total:** ~4–6 semanas de desenvolvimento no ritmo atual (as fases 0 e 1 podem correr em paralelo parcial).

---

# Anexos

## Anexo A — Princípios citados (fontes)
Todos destilados de posts públicos de **Richard ([@richardrx](https://x.com/richardrx))**, usados com permissão do autor, via skill `revenue-centric-design`. Fontes linkadas inline ao longo do relatório. Temas: conversion & landing pages, checkout & forms, onboarding & activation, pricing & monetization, churn & retention, positioning/ICP/GTM, metrics & experimentation.
**Uso permitido apenas fora do contexto de apostas/cassino/gambling** — a TemTrend não é um desses produtos.

## Anexo B — Tokens documentados vs. implementados
Ver tabela em **3.2**. Resumo: 4 de 10 tokens conferem; 6 divergem; ≥ 7 cores não documentadas em uso; resíduos TikTok (`#25f4ee`, `#fe2c55`) e Inter ainda ativos.

## Anexo C — Premissas, fontes e limitações (precificação)
- **Câmbio:** US$ 1 = R$ 5,40 (ajustar na data da decisão).
- **Imposto:** 6% (Simples Nacional, Anexo III) — validar com contador.
- **Tokens:** estimativas conservadoras a partir dos limites do código (≤3.000 saída por kit, ≤400 por busca, até 3 tentativas).
- **Preços AbacatePay:** PIX R$ 0,80; cartão 3,5% + R$ 0,60; boleto R$ 2,50 (fonte: abacatepay.com/pricing).
- **Gemini 3.1 Flash-Lite:** US$ 0,25/1M entrada; US$ 1,50/1M saída (fonte: ai.google.dev/gemini-api/docs/pricing).
- **Uso de IA:** perfil médio estimado; medir com `ai_metrics_daily` após o lançamento.
- **Catálogo:** **verificado via API AbacatePay em 18/10/2026 — 11 produtos ativos.**
- **Base de features:** código em `backend/` e `frontend/`.

## Anexo D — Inventário técnico (design)
- **CSS:** 22 arquivos, 366 KB, ~7.300 linhas, todos globais (`frontend/styles/`); `legacy-static/` com HTML/CSS/JS da fase anterior ainda no repo.
- **Arquivos de maior peso:** `platform-redesign.css` (45 KB), `design-system.css` (37 KB), `platform-theme.css` (34 KB), `landing-polish.css` (32 KB).
- **Camadas concorrentes de botão/card:** `design-system.css`, `platform-theme.css`, `ux-overhaul.css`, `platform-redesign.css`.
- **Fontes:** Manrope + Instrument Serif via `next/font` (`layout.tsx:26-36`) — aprovado, manter.

---

*Documento gerado por análise estática do código + skills de design e receita. Nenhuma alteração foi feita no projeto. Recomenda-se revisar preço/imposto com contador e validar os números de custo com as métricas reais de IA após o lançamento.*
