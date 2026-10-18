# Relatório de Precificação — TemTrend

**Data:** 17/10/2026 · **Versão:** 1.0 · **Escopo:** estudo de precificação, custos e monetização da plataforma TemTrend
**Premissa central:** 100% da primeira receita é reinvestida na própria plataforma (infra, IA, aquisição e reserva).

---

## 1. Sumário executivo

A TemTrend já tem produto pronto para cobrar: descoberta de produtos com IA, geração de roteiro completo, guia de gravação passo a passo e gestão de produção. Hoje **nada é cobrado** — o "Plano gratuito" é um texto fixo no código (`backend/src/modules/account/account.routes.ts:35`), sem assinatura, trial ou paywall.

O custo marginal por usuário é **muito baixo** (IA ≈ R$ 0,03 por roteiro; infra atual ≈ R$ 40/mês no modo enxuto), o que permite preço de entrada acessível com margem alta. O risco não é custo — é **posicionamento e catálogo**: a loja AbacatePay tem 11 produtos legados, duplicados e de outra fase do produto (marketplace), que precisam ser organizados antes de cobrar.

### Recomendação em uma tabela

| Plano | Preço mensal | Preço anual | Papel na escada |
|---|---:|---:|---|
| **Essencial** | R$ 29,90 | R$ 299 | Isca/entrada (decoy) |
| **Pro** | R$ 59,90 | R$ 599 | **Plano-alvo (~50% dos clientes)** |
| **Scale** | R$ 149 | R$ 1.490 | Âncora para agências/duplas |
| **Enterprise** | R$ 499+ | sob consulta | Âncora de preço |
| Avulso (experimento) | R$ 19,90 / 10 kits | — | Decoy que empurra a assinatura |

- **Trial:** 7 dias de Pro sem cartão; ao fim, amostra gratuita de 3 kits (não um plano free permanente).
- **Break-even:** 6 assinantes no modo "sério" (infra paga) ou 1 no modo enxuto. Com pró-labore de R$ 3.000: ~57 assinantes.
- **Margem de contribuição:** ~89–90% em qualquer cenário acima de 50 assinantes.
- **Primeira ação:** limpar o catálogo da AbacatePay, criar a linha "TemTrend Creator" e implementar billing + gating por plano.

---

## 2. O que a TemTrend oferece hoje (inventário completo)

### 2.1 Jornada do criador

| Etapa | O que o usuário faz | O que a plataforma entrega |
|---|---|---|
| **Landing** | Busca um produto ou clica em "Não sei o que vender" | Hero com busca, exemplos, seção "como funciona", as 8 partes do plano, carrossel de exemplos, FAQ. A busca sobrevive ao login. |
| **Cadastro/login** | Email/senha ou Google/Facebook/Apple | Conta grátis, recuperação de senha. Sessão só em memória (login a cada visita). |
| **Onboarding (5 etapas)** | Objetivo, estilos, temas, "sua voz" (opcional) | Personalização que alimenta a IA: temas entram na busca; a voz entra no roteiro. |
| **Descobrir** | Descreve o que quer vender | IA interpreta o pedido e devolve **até 5 produtos reais** do catálogo com motivo, preço, comissão estimada em R$, vendas e badges ("maior comissão", "mais vendido"). Filtro de categorias sensíveis. |
| **Kit de conteúdo** | Escolhe direções prontas (5) ou escreve um briefing | Gera um plano completo em 8 partes: **conceito, abertura/hook, cenas (3–8), roteiro, legenda, CTA, hashtags, áudio/duração** — com 3 variações de hook, versão sem aparecer, dica de publicação e 5 variações de roteiro. |
| **Guia de gravação** | Marca cena a cena o que já gravou | Checklist "antes de gravar", escolha de hook, "Mostre / Fale / Ação ou edição" por cena, progresso, cópia por etapa ou do plano inteiro. |
| **Minha produção** | Acompanha o funil | Status **salvo → em produção → gravado → publicado**, filtros, busca, ordenação por próxima ação, progresso (2/4), link do vídeo publicado (TikTok, opcional). |
| **Conta** | Edita perfil, preferências, voz, senha | "Sua voz" (até 500 caracteres) personaliza todos os roteiros; exclusão de conta; plano atual (hoje fixo em "gratuito"). |
| **Admin (interno)** | Opera catálogo e comunidade | Dashboard (creators, produtos, kits, publicações, uso de IA), CRUD de produtos, upload de imagem, gestão de kits, bloqueio/reativação de creators, export CSV. |

### 2.2 O que a IA faz (e custa)

| Operação | Entrada | Saída | Custo estimado* |
|---|---|---|---|
| Busca de produtos (`POST /assistant/products`) | ~1.200 tokens | ≤400 tokens | **≈ R$ 0,005** |
| Geração de kit (`POST /products/:id/content-kit`) | ~1.500–2.500 tokens (com retries) | ≤3.000 tokens | **≈ R$ 0,03** |

\* Gemini 3.1 Flash-Lite: US$ 0,25/1M entrada e US$ 1,50/1M saída; câmbio R$ 5,40. Há fallback automático para OpenRouter (modelo free) e fallback determinístico sem IA — o custo pode ser ainda menor.

### 2.3 Limites que já existem (hoje iguais para todos)

- **100 buscas de IA/dia** e **30 kits/dia** por usuário, com cooldown de 30s para "gerar outra versão" (`backend/src/lib/ai-metrics.ts:23-27`).
- Rate limits técnicos: 10 buscas/min, 5 kits/min, 200 req/min global.
- Cota persistida em banco (`ai_usage_daily`) e métricas de tokens/cache no admin — **a base para transformar em limite por plano já está pronta**.

### 2.4 O que a TemTrend NÃO oferece (hoje)

Não publica automaticamente, não edita vídeo, não garante vendas, não tem analytics de views/receita do creator, não tem integração de afiliados, não tem multiusuário/assentos, não tem exportação de dados para o creator. Isso importa para o preço: **não venda o que não existe** e use esses itens como roadmap de upgrade (upsell futuro), não como promessa atual.

---

## 3. Estrutura de custos (a base do preço)

### 3.1 Infraestrutura fixa

| Item | Hoje | Recomendado ao cobrar | Custo/mês |
|---|---|---|---:|
| Render (API) | **Free** (cold start de 30–60s) | Starter US$ 7 | R$ 37,80 |
| Vercel (frontend) | Hobby | Pro US$ 20 (obrigatório para uso comercial) | R$ 108,00 |
| Supabase (banco/auth/storage) | Free | Pro US$ 25 (backup diário, sem pausa) | R$ 135,00 |
| Domínio | ~R$ 40/ano | idem | R$ 3,33 |
| E-mail transacional | Resend free | free até 3k/mês | R$ 0 |
| **Total modo enxuto** | | Render Starter + Vercel Hobby + Supabase Free | **≈ R$ 41/mês** |
| **Total modo sério** | | Render Starter + Vercel Pro + Supabase Pro | **≈ R$ 284/mês** |

> O cold start do Render Free já foi causa de lentidão real no login. Antes de cobrar, **o Starter (US$ 7) é obrigatório** — é o upgrade com maior retorno por real.

### 3.2 Taxas da AbacatePay

| Método | Taxa | Em R$ 29,90 | Em R$ 59,90 | Em R$ 149 |
|---|---|---:|---:|---:|
| PIX | R$ 0,80 fixo | 2,7% | 1,3% | 0,5% |
| Cartão | 3,5% + R$ 0,60 | 5,5% | 4,5% | 3,9% |
| Boleto | R$ 2,50 | 8,4% | 4,2% | 1,7% |

**Implicação:** PIX é o método mais barato e deve ser o padrão. **Anual no PIX é o melhor negócio para a plataforma**: receita adiantada, taxa de R$ 0,80 única e churn praticamente zero por 12 meses.

### 3.3 Impostos (premissa)

Assumindo Simples Nacional Anexo III (serviços), alíquota inicial de **6%** sobre a receita bruta. Confirmar com contador (a empresa é LTDA/EPP; ISS e faixa podem variar). Reservar o imposto **desde o primeiro real**.

### 3.4 Receita líquida por plano (após taxa PIX + 6% de imposto)

| Plano | Bruto | Taxa PIX | Imposto | **Líquido** | % |
|---|---:|---:|---:|---:|---:|
| Essencial | 29,90 | 0,80 | 1,79 | **27,31** | 91,3% |
| Pro | 59,90 | 0,80 | 3,59 | **55,51** | 92,7% |
| Scale | 149,00 | 0,80 | 8,94 | **139,26** | 93,5% |

No cartão, o líquido cai ~R$ 1–6 por cobrança (ex.: Pro = R$ 53,61). Ainda saudável, mas reforça o incentivo ao PIX/anual.

### 3.5 Custo de IA por perfil de uso (mensal)

| Perfil | Buscas/mês | Kits/mês | Custo IA |
|---|---:|---:|---:|
| Leve | 10 | 5 | **R$ 0,20** |
| Médio | 60 | 20 | **R$ 0,90** |
| Pesado (teto atual: 30 kits/dia + 100 buscas/dia) | 3.000 | 900 | **R$ 42,00** |

**Conclusão:** o usuário médio custa menos de R$ 1/mês em IA. O usuário-pesado pode consumir um plano Essencial inteiro. **Os planos precisam de teto mensal de kits** — não por causa do usuário típico, mas para proteger a margem de quem abusa.

---

## 4. Auditoria do catálogo atual na AbacatePay

Produtos ativos hoje na loja **TemTrend.AI** (preços em centavos na API):

| Produto | Preço | Ciclo | Diagnóstico |
|---|---:|---|---|
| 2 Campanhas Avulsas | R$ 49,99 | único | Legado de marketplace — não corresponde ao app atual |
| 1 Campanha Avulsa | R$ 29,99 | único | Legado de marketplace |
| Scale | R$ 499,00 | mensal | Legado (propostas/Smart Match) — preço 3,3x o recomendado |
| Pro | R$ 178,00 | mensal | Legado — preço 3x o recomendado |
| Essencial | R$ 96,00 | mensal | Legado — preço 3,2x o recomendado |
| TemTrend Enterprise | R$ 699,00 | mensal | Pode ser reaproveitado como âncora (> R$ 499) |
| TemTrend Pro | R$ 199,00 | mensal | Legado — substituir |
| TrendPulse PRO | R$ 19,90 | único | **3 duplicatas** (R$ 19,90, R$ 19,90 e R$ 1,99) — provável teste |
| TrendPulse PRO | R$ 19,90 | único | Duplicata |
| TrendPulse PRO | R$ 1,99 | único | Preço de teste |
| Modo PRO - TemTren.AI | R$ 19,90 | único | Nome com typo, legado |

**Recomendação:** não excluir o histórico; **pausar/arquivar** os produtos legados e criar uma linha nova com `externalId` claro (`creator_essencial_monthly`, `creator_pro_monthly`, `creator_scale_monthly`, versões `_yearly` e `creator_kits_10`). Nomes: **TemTrend Essencial / TemTrend Pro / TemTrend Scale / TemTrend Enterprise**. Sem isso, o cliente vê ofertas conflitantes e a cobrança nasce confusa.

---

## 5. Valor percebido e âncoras de preço

### 5.1 O que o cliente ganha (proxy de valor, sem prometer vendas)

- **Tempo:** 1–2h para pesquisar produto + escrever roteiro + montar plano. A 30 kits/mês, são **30–60h economizadas** — a R$ 25/h, R$ 750–1.500/mês de valor.
- **Comissão:** catálogo com produtos de R$ 30–150 e comissões de ~10–25% → R$ 3–37 por venda. **3 a 5 vendas extras no mês pagam o Essencial.**
- **Redução de erro:** o guia evita gravar sem plano, escolher produto ruim e publicar sem CTA.

### 5.2 Âncoras de comparação

| Alternativa | Custo típico |
|---|---|
| Agência/gestor de conteúdo | R$ 300–1.000/mês |
| Curso de TikTok Shop | R$ 200–500 (único, sem ferramenta) |
| Freelancer de roteiro | R$ 50–150 por roteiro |
| **TemTrend Pro** | **R$ 59,90/mês (≈ R$ 2/dia)** |

O Pro a R$ 59,90 é **~5–10% do custo de uma agência** e menos que **1 roteiro de freelancer**. Essa é a moldura de comparação a usar na página de planos — nunca comparar com "grátis".

---

## 6. Estratégia de precificação (racional)

1. **Good-Better-Best (GBB):** três planos visíveis + Enterprise como âncora. O Essencial é a isca: tem limite que dói (sem voz personalizada, sem "gerar outra versão"), faz o Pro parecer óbvio por +R$ 30.
2. **Sem plano gratuito permanente:** free ancora o preço em zero e destrói a percepção de valor. No lugar: **trial de 7 dias** + amostra de 3 kits. O custo de um free user é baixo, mas o custo de *posicionamento* é alto.
3. **Uma única escada de valor:** volume de kits/mês (30 → 100 → 300 → fair use). Não misturar "10.000 tokens" com "suporte prioritário" na mesma comparação.
4. **Anual com desconto de 2 meses:** melhora caixa, reduz churn e a taxa PIX cai para centavos. Empurrar anual no PIX.
5. **Preço como filtro:** não descer de R$ 29,90. Preço baixo atrai comprador não comprometido e aumenta churn — exatamente o oposto do que a primeira receita precisa.
6. **Upgrade no momento do limite:** quando o usuário bate no teto de kits, mostrar o que ele já produziu ("você já criou 30 roteiros; no Pro são 100") — perda percebida, não feature nova.
7. **Reajuste:** revisar preço só com valor novo entregue (analytics, assentos, exportação), nunca "aumento seco". Testar preço novo apenas em clientes novos.

---

## 7. Planos recomendados

### 7.1 Matriz de recursos

| Recurso | Amostra grátis | Essencial R$ 29,90 | Pro R$ 59,90 | Scale R$ 149 | Enterprise R$ 499+ |
|---|---:|---:|---:|---:|---:|
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

\* Itens a construir (ver roadmap). Os demais já existem no código e podem ser limitados por plano imediatamente.

### 7.2 Preços e papéis

| Plano | Mensal | Anual (2 meses grátis) | Equivalente mensal no anual | Público | Papel |
|---|---:|---:|---:|---|---|
| **Essencial** | R$ 29,90 | R$ 299 | R$ 24,92 | Creator iniciante | Decoy: limita voz e variações |
| **Pro** | R$ 59,90 | R$ 599 | R$ 49,92 | Creator ativo (foco) | **Alvo: ~50% da base** |
| **Scale** | R$ 149 | R$ 1.490 | R$ 124,17 | Duplas e agências | Âncora + volume/assentos |
| **Enterprise** | R$ 499+ | sob consulta | — | Operações maiores | Âncora de preço |
| Avulso | R$ 19,90 (10 kits) | — | — | Quem não quer assinar | Decoy: 10 kits avulsos vs 30/mês + features |

**Preço por kit percebido:** Essencial R$ 1,00 · Pro R$ 0,60 · Scale R$ 0,50 → escada linear e fácil de explicar.

### 7.3 Trial

- **7 dias de Pro**, sem cartão, com onboarding completo (o "aha" é o primeiro kit pronto + guia).
- E-mails: dia 0 (boas-vindas), dia 2 (primeiro kit), dia 5 (o que você já criou), dia 7 (fim do trial + oferta anual).
- Ao expirar: cai para a **amostra de 3 kits**, sem apagar nada. O histórico fica visível, mas bloqueado para novos roteiros — perda percebida no momento certo.
- Não pedir cartão no trial nesta fase: o preço é baixo e o público brasileiro responde melhor a PIX. Medir conversão e, se ficar abaixo de 10%, testar trial com cartão no Pro.

---

## 8. Unit economics

### 8.1 Premissas

- Mix: 35% Essencial, 50% Pro, 15% Scale → **ARPU R$ 62,77**.
- Receita líquida média (PIX + 6% imposto): **R$ 58,20/assinante/mês**.
- IA média: **R$ 0,90/assinante/mês**.
- Churn base: 8%/mês (12,5 meses de vida média).
- CAC orgânico ≈ R$ 0; CAC pago hipótese: R$ 100.

### 8.2 Cenários

| Assinantes | MRR | Receita líquida | Custos fixos | IA | Outros | **Contribuição** | Margem |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 20 | R$ 1.255 | R$ 1.164 | R$ 41 (enxuto) | R$ 18 | — | **R$ 1.105** | 88% |
| 50 | R$ 3.139 | R$ 2.910 | R$ 41 | R$ 45 | — | **R$ 2.824** | 90% |
| 200 | R$ 12.554 | R$ 11.640 | R$ 284 (sério) | R$ 180 | — | **R$ 11.176** | 89% |
| 1.000 | R$ 62.770 | R$ 58.200 | R$ 800 | R$ 900 | R$ 700 | **R$ 55.800** | 89% |

### 8.3 Break-even

| Cenário | Custo fixo mensal | Assinantes necessários (líquido R$ 58,20) |
|---|---:|---:|
| Modo enxuto | R$ 41 | **1** |
| Modo sério (infra paga) | R$ 284 | **5–6** |
| Com pró-labore R$ 3.000 | R$ 3.284 | **~57** |

### 8.4 LTV, CAC e payback

- **LTV (churn 8%):** R$ 58,20 × 12,5 = **R$ 727**.
- **LTV (churn 12%):** R$ 58,20 × 8,3 = **R$ 485**.
- **CAC R$ 100 → payback 1,7 mês; LTV/CAC 4,8–7,3x.**
- Regra de saúde: manter **payback < 3 meses** e **LTV/CAC > 3x**. Com preço acima de R$ 29,90 e churn controlado, a conta fecha com folga.

### 8.5 Sensibilidade a preço

Se o Pro subir de R$ 59,90 para R$ 79,90 (+33%) e 20% dos clientes churnarem, a receita líquida por cliente remanescente sobe ~25% e o caixa melhora sem custo de aquisição. **Preço é a alavanca mais barata** — revisar a cada 6–12 meses, sempre com valor novo entregue.

---

## 9. Regra do caixa: "primeiro dinheiro 100% para a plataforma"

### 9.1 Alocação por fase

| Fase | MRR | Alocação da receita |
|---|---|---|
| **Fase 0 — fundação** | até R$ 1.000 | 100% reinvestido: Render Starter (mata cold start), Supabase Pro, domínio, reserva de impostos e primeiros testes de anúncio |
| **Fase 1 — tração** | R$ 1.000–5.000 | 40% growth (ads/parcerias), 30% infra/IA, 20% reserva de caixa, 10% impostos |
| **Fase 2 — escala** | acima de R$ 5.000 | 30% growth, 20% infra, 30% reserva (3 meses), 20% produto/equipe |

### 9.2 Regras

1. **Imposto sai primeiro:** reservar 6% de toda entrada (ou a alíquota confirmada pelo contador).
2. **Reserva mínima:** 3 meses de custo fixo antes de qualquer retirada.
3. **Nada de retirada** antes de R$ 5.000 de MRR — condizente com a premissa de reinvestir 100%.
4. **Gatilhos de revisão de preço:** conversão trial→pago > 25%, churn < 5% por 3 meses, custo de IA > 10% da receita líquida, ou fila de suporte acima de 48h.

---

## 10. Riscos e mitigação

| Risco | Impacto | Mitigação |
|---|---|---|
| Catálogo AbacatePay legado/duplicado | Cliente confuso, cobrança errada | Arquivar legados; criar linha `creator_*` com nomes e descrições claros |
| Não existe billing no código | Nenhuma receita | Implementar tabela de planos, checkout, webhook e gating (roadmap) |
| Cold start do Render Free | Perda de conversão no login | Subir para Starter antes de cobrar (US$ 7) |
| Usuário-pesado de IA | Consome o ticket inteiro | Teto mensal de kits por plano; fair use nas buscas |
| Churn do PIX recorrente | Receita instável | Empurrar anual no PIX; trial sem cartão; lembretes de valor |
| Trial abuse | Custo e suporte | Limite de 1 trial por conta/CPF; amostra grátis limitada |
| Webhook não verificado | Fraude/ativação indevida | Validar assinatura e idempotência no backend |
| Chave de produção em testes | Cobranças reais | Usar chave de dev/teste no ambiente local; produção só no Render |
| Expectativa de "vender sozinho" | Reembolso e churn | Copy honesta: a plataforma planeja e organiza, não garante vendas |
| Impostos | Multa | Reservar 6% desde o dia 1 e validar com contador |

---

## 11. Roadmap de implementação

| Fase | Entrega | Esforço |
|---|---|---|
| **0. Catálogo** | Arquivar produtos legados; criar Essencial/Pro/Scale/Enterprise (mensal + anual) e avulso na AbacatePay | 0,5 dia |
| **1. Dados** | Migration `026_billing.sql`: colunas `plan`, `plan_status`, `trial_ends_at`, `seats`, tabelas `subscriptions` e `billing_events` | 1 dia |
| **2. Backend** | Módulo `billing`: criar checkout, webhook assinado/idempotente, consulta de plano, middleware de gating e cotas por plano | 2–3 dias |
| **3. Frontend** | Página `/planos` (GBB + anual), card do plano na conta, banner de trial, modal de upgrade no limite | 2 dias |
| **4. Trial e e-mails** | Trial de 7 dias, queda para amostra, e-mails Resend (boas-vindas, fim de trial, falha de pagamento) | 1 dia |
| **5. QA e métricas** | Testes unitários/e2e do gating, evento de checkout, painel admin de assinaturas | 1–2 dias |

**Total estimado:** 8–10 dias de desenvolvimento. Ordem recomendada: catálogo → dados → backend → frontend → trial.

---

## 12. Premissas, fontes e limitações

- **Câmbio:** US$ 1 = R$ 5,40 (ajustar na data da decisão).
- **Imposto:** 6% (Simples Nacional, Anexo III) — validar com contador.
- **Tokens:** estimativas conservadoras a partir dos limites do código (`≤3.000` tokens de saída por kit, `≤400` por busca, até 3 tentativas).
- **Preços AbacatePay:** PIX R$ 0,80; cartão 3,5% + R$ 0,60; boleto R$ 2,50 (fonte: abacatepay.com/pricing).
- **Gemini 3.1 Flash-Lite:** US$ 0,25/1M entrada; US$ 1,50/1M saída (fonte: ai.google.dev/gemini-api/docs/pricing).
- **Uso de IA:** perfil médio estimado; medir com `ai_metrics_daily` após o lançamento.
- **Catálogo:** consultado via API AbacatePay em 17/10/2026 (11 produtos ativos).
- **Base de features:** código em `backend/` e `frontend/` (inventário detalhado na seção 2).
- **Princípios de precificação:** Revenue-Centric Design — GBB, decoy, ancoragem, efeito de posição serial, aversão à perda no upgrade.

> Este relatório é um estudo, não uma garantia de resultado. Os números de conversão, churn e CAC são hipóteses a validar com dados reais após o lançamento.
