# Relatório de Precificação — TemTrend

**Data:** 17/10/2026 · **Versão:** 1.2 (atualizada em 27/10/2026 — ver seção 0) · **Escopo:** estudo de precificação, custos e monetização da plataforma TemTrend
**Premissa central:** 100% da primeira receita é reinvestida na própria plataforma (infra, IA, aquisição e reserva).

> **Como ler este documento.** É um **estudo de precificação**, não a tabela de preços oficial. O catálogo vigente está na seção 1 e em `backend/src/modules/billing/plans.ts`. Seções com o selo **[histórico]** registram hipóteses e decisões da época em que foram escritas (incluindo planos Essencial/Scale e trial de 7 dias, que **não** são vendidos hoje) e são mantidas apenas como registro analítico.

---

## 0. Atualização do estágio atual da plataforma (27/10/2026)

A arquitetura de precificação e produtos foi **simplificada e consolidada em produção** (migrations `031_pricing_launch_fair_use` e `032_launch_seats_distinct`):

1. **Aposentadoria da escada legada (Essencial / Scale):**
   - Os planos **Essencial (R$ 29,90)** e **Scale (R$ 149)** foram **descontinuados para novas vendas**. Permanecem no código (`LEGACY_PRODUCTS`) apenas para manter compatibilidade com eventuais assinantes legados.
   - Não há mais divisão artificial de recursos como "proibir voz personalizada" ou limitar a 30/100 kits/mês.
2. **Plano Pago Único — Pro Ilimitado:**
   - Preço padrão: **R$ 49,90/mês** ou **R$ 499/ano**.
   - **Oferta de Lançamento (encerrada para novas vendas em 24/10/2026):** R$ 39,90/mês ou R$ 399/ano para as primeiras 100 vagas. Permanece apenas nas renovações de quem já assinou nessa condição (`LAUNCH_OFFER_ENABLED = false`).
   - **Sem cotas diárias visíveis:** Buscas de IA e Kits de Conteúdo são **ilimitados na experiência normal**. O backend aplica tetos internos de uso justo (`FAIR_USE_KITS_PER_MONTH = 1000` e `FAIR_USE_SEARCHES_PER_DAY = 1000`) contra robôs e automações.
3. **Plano Grátis (Degustação):**
   - Degustação gratuita com 100 buscas/semana e 10 roteiros/semana.
4. **Enterprise:**
   - Sob consulta ("Falar com a gente") para grandes operações e volumes customizados.

> **Status operacional (13/11/2026):** este é o catálogo que o código vende. As migrations até `045` estão aplicadas no projeto Supabase verificado e o catálogo tem ~3,7 mil produtos ativos — ver `backend/supabase/migrations/README.md`.

---

## 1. Sumário executivo (Catálogo Vigente)

| Plano | Preço mensal | Preço anual | Regra de uso | Papel comercial |
|---|---:|---:|---|---|
| **Grátis** | R$ 0 | R$ 0 | 100 buscas/semana e 10 roteiros/semana | Degustação gratuita para experimentar |
| **Pro (Lançamento)** | **R$ 39,90** | **R$ 399** | **Ilimitado** (uso justo 1.000/mês) | **100 primeiras vagas** com preço mantido enquanto a assinatura estiver ativa |
| **Pro (Padrão)** | **R$ 49,90** | **R$ 499** | **Ilimitado** (uso justo 1.000/mês) | **Oferta principal** para creators ativos |
| **Enterprise** | Sob consulta | Sob consulta | Personalizado | Operações especiais e agências |
| ~~Essencial~~ | ~~R$ 29,90~~ | ~~R$ 299~~ | — | **Aposentado** — não é mais comercializado |
| ~~Scale~~ | ~~R$ 149~~ | ~~R$ 1.490~~ | — | **Aposentado** — não é mais comercializado |
| ~~Avulso~~ | ~~R$ 19,90 / 10 kits~~ | — | — | **Removido** |

- **Sem contagem regressiva de cotas diárias:** No Pro, o criador produz sem a ansiedade de limites diários (como os antigos 100 buscas/dia ou 30 kits/dia).
- **Margem de contribuição:** Mantém-se entre **88% e 92%** com IA a ~R$ 0,03 por roteiro.
- **Break-even:** Atingível com apenas 1 a 6 assinantes dependendo do plano de hospedagem.

---

## 2. O que a TemTrend oferece hoje (inventário completo)

### 2.1 Jornada do criador

| Etapa | O que o usuário faz | O que a plataforma entrega |
|---|---|---|
| **Landing** | Busca um produto ou clica em "Não sei o que vender" | Hero com busca, exemplos, seção "como funciona", as 8 partes do plano, carrossel de exemplos, FAQ. A busca sobrevive ao login. |
| **Cadastro/login** | Email/senha ou Google/Facebook/Apple | Recuperação de senha; reenvio de confirmação de e-mail. **[20/10: sem "conta grátis" como plano (seção 0); sessão só em memória (login a cada acesso)]** |
| **Onboarding (5 etapas)** | Objetivo, estilos, temas, "sua voz" (opcional) | Personalização que alimenta a IA: temas entram na busca; a voz entra no roteiro. |
| **Descobrir** | Descreve o que quer vender | IA interpreta o pedido e devolve **até 5 produtos reais** do catálogo com motivo, preço, comissão estimada em R$, vendas e badges ("maior comissão", "mais vendido"). Filtro de categorias sensíveis. |
| **Kit de conteúdo** | Escolhe direções prontas (5) ou escreve um briefing | Gera um plano completo em 8 partes: **conceito, abertura/hook, cenas (3–8), roteiro, legenda, CTA, hashtags, áudio/duração** — com 3 variações de hook, versão sem aparecer, dica de publicação e 5 variações de roteiro. |
| **Guia de gravação** | Marca cena a cena o que já gravou | Checklist "antes de gravar", escolha de hook, "Mostre / Fale / Ação ou edição" por cena, progresso, cópia por etapa ou do plano inteiro. |
| **Minha produção** | Acompanha o funil | Status **salvo → em produção → gravado → publicado**, filtros, busca, ordenação por próxima ação, progresso (2/4), link do vídeo publicado (TikTok, opcional e manual). |
| **Conteúdos** | Consulta a biblioteca de roteiros | Lista de conteúdos com filtros, cópia de gancho, abertura do kit e agendamento editorial. |
| **Calendário** | Planeja a semana/mês | Calendário editorial com status e data planejada por conteúdo (não publica automaticamente). |
| **Conta** | Edita perfil, preferências, voz, senha | "Sua voz" (até 500 caracteres) personaliza todos os roteiros; exclusão de conta; plano atual (renovação, troca agendada, cancelamento, `past_due` e retorno ao Grátis). **Não há trial.** |
| **Admin (interno)** | Opera catálogo e comunidade | Dashboard (creators, produtos, kits, publicações, uso de IA), CRUD de produtos, upload de imagem, gestão de kits, bloqueio/reativação de creators, export CSV. |

### 2.2 O que a IA faz (e custa)

| Operação | Entrada | Saída | Custo estimado* |
|---|---|---|---|
| Busca de produtos (`POST /assistant/products`) | ~1.200 tokens | ≤400 tokens | **≈ R$ 0,005** |
| Geração de kit (`POST /products/:id/content-kit`) | ~1.500–2.500 tokens (com retries) | ≤3.000 tokens | **≈ R$ 0,03** |

\* Gemini 3.1 Flash-Lite: US$ 0,25/1M entrada e US$ 1,50/1M saída; câmbio R$ 5,40. Há fallback automático para OpenRouter (modelo free) e fallback determinístico sem IA — o custo pode ser ainda menor.

### 2.3 Regras de uso e cotas no estágio atual

- **Plano Grátis:** 100 buscas/semana e 10 roteiros/semana (buscas e roteiros renovam toda segunda).
- **Plano Pro:** **Ilimitado** para o usuário. O backend aplica apenas uma proteção interna de uso justo (`FAIR_USE_KITS_PER_MONTH = 1000`) para mitigar abusos ou automação, além de cooldown de 30s para geração de variações (`force_new`).
- Rate limits técnicos de segurança: 10 buscas/min, 5 kits/min, 200 req/min global.
- Cota persistida em banco (`ai_usage_daily`) e métricas de tokens/cache acompanhadas pelo painel administrativo.

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

| Método | Taxa | Em R$ 39,90 | Em R$ 49,90 | Em R$ 399 |
|---|---|---:|---:|---:|
| PIX | R$ 0,80 fixo | 2,0% | 1,6% | 0,2% |
| Cartão | 3,5% + R$ 0,60 | 5,0% | 4,7% | 3,7% |
| Boleto | R$ 2,50 | 6,3% | 5,0% | 0,6% |

**Implicação:** PIX é o método mais barato e deve ser o padrão. **Anual no PIX é o melhor negócio para a plataforma**: receita adiantada, taxa de R$ 0,80 única e churn praticamente zero por 12 meses.

### 3.3 Impostos (premissa)

Assumindo Simples Nacional Anexo III (serviços), alíquota inicial de **6%** sobre a receita bruta. Confirmar com contador (a empresa é LTDA/EPP; ISS e faixa podem variar). Reservar o imposto **desde o primeiro real**.

### 3.4 Receita líquida por plano (após taxa PIX + 6% de imposto)

| Plano | Bruto | Taxa PIX | Imposto | **Líquido** | % |
|---|---:|---:|---:|---:|---:|
| Pro lançamento mensal | 39,90 | 0,80 | 2,39 | **36,71** | 92,0% |
| Pro padrão mensal | 49,90 | 0,80 | 2,99 | **46,11** | 92,4% |
| Pro lançamento anual | 399,00 | 0,80 | 23,94 | **374,26** | 93,8% |
| Pro padrão anual | 499,00 | 0,80 | 29,94 | **468,26** | 93,8% |

No cartão, o líquido cai cerca de R$ 1,5–3 por cobrança mensal (ex.: Pro padrão = R$ 44,56). Ainda saudável, mas reforça o incentivo ao PIX/anual.

### 3.5 Custo de IA por perfil de uso (mensal)

| Perfil | Buscas/mês | Kits/mês | Custo IA |
|---|---:|---:|---:|
| Leve | 10 | 5 | **R$ 0,20** |
| Médio | 60 | 20 | **R$ 0,90** |
| Pesado (teto interno: 1.000 kits/mês) | 3.000 | 1.000 | **≈ R$ 45,00** |

**Conclusão:** o usuário médio custa menos de R$ 1/mês em IA. No teto interno de 1.000 kits/mês o custo (~R$ 45) chega perto do líquido do Pro mensal (~R$ 46) e zera a margem — por isso o teto é interno e, ao ser atingido, vira conversa comercial em vez de upgrade automático.

---

## 4. [histórico] Auditoria do catálogo na AbacatePay (17/10/2026)

Produtos ativos na loja **TemTrend.AI** na consulta de 17/10/2026 (preços em centavos na API). Vários itens já foram arquivados ou excluídos desde então; a linha vigente é a de Pro/Lançamento descrita na seção 1.

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

**O que foi feito depois:** o catálogo de vendas foi reduzido a **Pro (mensal/anual, padrão e lançamento) + Enterprise sob consulta**; o produto avulso de kits foi excluído e os produtos legados ficaram fora da contratação. A recomendação de criar Essencial/Scale/avulso **não** foi seguida — a escada de três planos foi aposentada.

---

## 5. Valor percebido e âncoras de preço

### 5.1 O que o cliente ganha (proxy de valor, sem prometer vendas)

- **Tempo:** 1–2h para pesquisar produto + escrever roteiro + montar plano. A 20 kits/mês, são **20–40h economizadas** — a R$ 25/h, R$ 500–1.000/mês de valor.
- **Comissão:** catálogo com produtos de R$ 30–150 e comissões de ~10–25% → R$ 3–37 por venda. **2 a 4 vendas extras no mês pagam o Pro.**
- **Redução de erro:** o guia evita gravar sem plano, escolher produto ruim e publicar sem CTA.

### 5.2 Âncoras de comparação

| Alternativa | Custo típico |
|---|---|
| Agência/gestor de conteúdo | R$ 300–1.000/mês |
| Curso de TikTok Shop | R$ 200–500 (único, sem ferramenta) |
| Freelancer de roteiro | R$ 50–150 por roteiro |
| **TemTrend Pro** | **R$ 49,90/mês (≈ R$ 1,66/dia)** |

O Pro a R$ 49,90 é **~5–10% do custo de uma agência** e menos que **1 roteiro de freelancer**. Essa é a moldura de comparação a usar na página de planos — nunca comparar com "grátis".

---

## 6. [histórico] Estratégia de precificação (racional de 17/10/2026)

> Esta seção registra o racional considerado na época. **Não é a estratégia vigente:** a escada GBB com três planos, o trial de 7 dias e o "sem plano gratuito permanente" não foram adotados. Hoje o catálogo é **Plano Grátis + Pro único + Enterprise sob consulta** (seção 1).

1. **GBB (não adotado):** três planos visíveis + Enterprise como âncora. O Essencial seria a isca: limite que dói (sem voz personalizada, sem "gerar outra versão"), fazendo o Pro parecer óbvio por +R$ 30.
2. **[não adotado] Sem plano gratuito permanente:** a hipótese era usar trial de 7 dias no lugar do free. A decisão final foi o oposto: **Plano Grátis como porta de entrada**, sem trial; os limites do modelo gratuito ficam definidos no backend.
3. **Uma única escada de valor:** volume de kits/mês (30 → 100 → 300 → fair use). Não misturar "10.000 tokens" com "suporte prioritário" na mesma comparação.
4. **Anual com desconto de 2 meses:** melhora caixa, reduz churn e a taxa PIX cai para centavos. Empurrar anual no PIX.
5. **Preço como filtro:** não descer de R$ 29,90. Preço baixo atrai comprador não comprometido e aumenta churn — exatamente o oposto do que a primeira receita precisa.
6. **Upgrade no momento do limite:** quando o usuário bate no teto do Grátis, mostrar o que ele já produziu e que no Pro a criação é ilimitada (com uso justo) — perda percebida, não feature nova.
7. **Reajuste:** revisar preço só com valor novo entregue (analytics, assentos, exportação), nunca "aumento seco". Testar preço novo apenas em clientes novos.

---

## 7. Planos recomendados

### 7.1 Matriz de recursos (Estágio Atual)

| Recurso | Plano Grátis | Plano Pro (Padrão & Lançamento) | Enterprise |
|---|---:|---:|---:|
| Kits de conteúdo | Limites definidos no backend | **Ilimitado** (uso justo 1.000/mês) | Customizado |
| Buscas de IA | Limites definidos no backend | **Ilimitado** | Customizado |
| Variações de roteiro | não | sim (cooldown 30s) | sim |
| Voz personalizada no roteiro | não | sim | sim |
| Roteiros salvos por produto | até 3 | **ilimitado** | **ilimitado** |
| Guia de gravação + produção | até 3 itens | **ilimitado** | **ilimitado** |
| Histórico de criações | visível | visível | visível |
| Suporte | comunidade / in-app | e-mail + suporte in-app | prioritário / dedicado |

### 7.2 Preços e Ofertas Ativas

| Plano / Oferta | Mensal | Anual (2 meses grátis) | Equivalente mensal no anual | Público-alvo |
|---|---:|---:|---:|---|
| **Plano Grátis** | R$ 0 | R$ 0 | R$ 0 | Degustação gratuita (100 buscas/semana e 10 roteiros/semana) |
| **Pro — Lançamento (100 vagas)** | **R$ 39,90** | **R$ 399** | **R$ 33,25** | Primeiros 100 creators (preço mantido enquanto a assinatura estiver ativa) |
| **Pro — Padrão** | **R$ 49,90** | **R$ 499** | **R$ 41,58** | Creators ativos de TikTok Shop |
| **Enterprise** | Sob consulta | Sob consulta | — | Agências e operações em escala |
| ~~Essencial~~ | ~~R$ 29,90~~ | ~~R$ 299~~ | — | **Aposentado** |
| ~~Scale~~ | ~~R$ 149~~ | ~~R$ 1.490~~ | — | **Aposentado** |

### 7.3 Porta de Entrada e Degustação

- **Degustação gratuita:** 100 buscas/semana e 10 roteiros/semana, sem prazo de expiração (substituiu o antigo trial de 7 dias com bloqueio forçado).
- O criador testa o fluxo completo até o final (busca o produto, gera o kit completo em 8 partes e usa o modo estúdio de gravação).
- Ao atingir o limite gratuito, recebe o convite para migrar para o Pro aproveitando as vagas de lançamento.

---

## 8. Unit economics

### 8.1 Premissas

- Mix: 60% lançamento / 40% padrão e 50% mensal / 50% anual → **ARPU bruto ≈ R$ 40,24**.
- Receita líquida média (PIX R$ 0,80 + 6% de imposto): **≈ R$ 37,03/assinante/mês**.
- IA média: **R$ 0,90/assinante/mês**.
- Churn base: 8%/mês (12,5 meses de vida média).
- CAC orgânico ≈ R$ 0; CAC pago hipótese: R$ 100.

### 8.2 Cenários

| Assinantes | MRR | Receita líquida | Custos fixos | IA | Outros | **Contribuição** | Margem |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 20 | R$ 805 | R$ 741 | R$ 41 (enxuto) | R$ 18 | — | **R$ 682** | 85% |
| 50 | R$ 2.012 | R$ 1.852 | R$ 41 | R$ 45 | — | **R$ 1.766** | 88% |
| 200 | R$ 8.048 | R$ 7.406 | R$ 284 (sério) | R$ 180 | — | **R$ 6.942** | 86% |
| 1.000 | R$ 40.240 | R$ 37.030 | R$ 800 | R$ 900 | R$ 700 | **R$ 34.630** | 86% |

### 8.3 Break-even

| Cenário | Custo fixo mensal | Assinantes necessários (líquido R$ 37,03) |
|---|---:|---:|
| Modo enxuto | R$ 41 | **2** |
| Modo sério (infra paga) | R$ 284 | **8** |
| Com pró-labore R$ 3.000 | R$ 3.284 | **~89** |

### 8.4 LTV, CAC e payback

- **LTV (churn 8%):** R$ 37,03 × 12,5 = **≈ R$ 463**.
- **LTV (churn 12%):** R$ 37,03 × 8,3 = **≈ R$ 308**.
- **CAC R$ 100 → payback 2,7 meses; LTV/CAC 3,1–4,6x.**
- Regra de saúde: manter **payback < 3 meses** e **LTV/CAC > 3x**. Com o preço atual e churn controlado, a conta fecha, mas com menos folga do que na hipótese de R$ 59,90.

### 8.5 Sensibilidade a preço

Se o Pro padrão subir de R$ 49,90 para R$ 59,90 (+20%), cada cliente remanescente rende ~20% mais; mesmo perdendo 20% da base, o MRR total cai apenas ~4%. **Preço é a alavanca mais barata** — revisar a cada 6–12 meses, sempre com valor novo entregue.

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
4. **Gatilhos de revisão de preço:** conversão Grátis→Pro acima de 8%, churn < 5% por 3 meses, custo de IA > 10% da receita líquida, ou fila de suporte acima de 48h.

---

## 10. Riscos e mitigação

| Risco | Impacto | Mitigação |
|---|---|---|
| Produtos v1 legados ainda ativos na conta AbacatePay | Cliente confuso, cobrança errada | Manter fora da contratação; arquivar no painel quando não houver mais assinantes antigos |
| Cobrança desligada por falta da `ABACATEPAY_API_KEY` no Render | Nenhuma receita | Definir a chave + Starter (`docs/go-live-billing.md`); o gating do Grátis já funciona |
| Cold start do Render Free | Perda de conversão no login | Subir para Starter antes de cobrar (US$ 7) |
| Usuário-pesado de IA | Consome o ticket inteiro | Teto interno de uso justo (1.000 kits/mês) e conversa comercial ao atingir |
| PIX avulso (sem recorrência automática) | Receita instável, renovação manual | Empurrar anual no PIX; aviso de renovação na conta; lembretes de valor |
| Webhook não verificado | Fraude/ativação indevida | Validar assinatura e idempotência no backend |
| Chave de produção em testes | Cobranças reais | Usar chave de dev/teste no ambiente local; produção só no Render |
| Expectativa de "vender sozinho" | Reembolso e churn | Copy honesta: a plataforma planeja e organiza, não garante vendas |
| Impostos | Multa | Reservar 6% desde o dia 1 e validar com contador |

---

## 11. [histórico] Roadmap de implementação (17/10/2026)

| Fase | Entrega original | Status em 27/10/2026 |
|---|---|---|
| **0. Catálogo** | Arquivar legados; criar Essencial/Pro/Scale/Enterprise e avulso | Feito em parte: catálogo reduzido a **Pro + Enterprise**; Essencial/Scale/avulso não são vendidos |
| **1. Dados** | Colunas de plano e tabelas de billing | Feito na `028_billing.sql` (a `026`/`027` são imports FastMoss e analytics) |
| **2. Backend** | Checkout, webhook idempotente, gating e cotas | Feito — `backend/src/modules/billing/` |
| **3. Frontend** | `/planos`, card na conta, modal de upgrade | Feito — sem banner de trial (não existe trial) |
| **4. Trial e e-mails** | Trial de 7 dias + e-mails Resend | **Não adotado**: O Plano Grátis substituiu o trial. E-mails de renovação/cobrança continuam pendentes |
| **5. QA e métricas** | Testes do gating, evento de checkout, painel admin | Feito — testes de billing e painel de assinaturas |

> **Status:** o roadmap foi concluído com uma mudança de produto: em vez da escada Essencial/Pro/Scale com trial, a plataforma vende **um único Pro** (com oferta de lançamento) e mantém o **Plano Grátis** como porta de entrada. Falta operacional: `ABACATEPAY_API_KEY` no Render + upgrade para Starter.

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
