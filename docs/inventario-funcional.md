# Inventário funcional — TemTrend

**Versão:** 1.1 · **Data:** 13/11/2026
**Público:** time interno (produto, engenharia, suporte e comercial)
**Escopo:** o que está implementado hoje no código (frontend, backend e migrations 001–035), não o roadmap.
**Como ler:** cada item indica **No ar**, **Parcial**, **Condicionado** (depende de flag/chave) ou **Não existe**.

> Documento interno gerado a partir do código. Não é material de marketing e não substitui os termos legais.

---

## 0. TL;DR

- **Produto:** descoberta de produtos + plano de gravação em 8 partes + guia de gravação + organização de produção/conteúdos/calendário.
- **Diferencial real:** transforma uma ideia vaga em um roteiro gravável, com cenas, falas, CTA e hashtags — e acompanha até o status "publicado".
- **Modelo:** Grátis com 100 buscas/semana e 10 roteiros/semana, e Pro (R$ 49,90/mês ou R$ 499/ano). A condição de lançamento foi encerrada para novas vendas e permanece apenas em renovações antigas.
- **Não faz:** não publica no TikTok, não edita vídeo e não mede vendas. Publicação é manual.
- **Cobrança:** AbacatePay (cartão recorrente ou PIX pré-pago), atrás da flag `BILLING_ENABLED`.
- **Operação:** admin com catálogo, creators, assinaturas, suporte, uso de IA e funil de 30 dias.

---

## 1. Em uma frase

A TemTrend leva o creator do "o que eu vendo?" ao "vídeo gravado e organizado": descobre produtos reais do catálogo, gera um plano de gravação em 8 partes, guia a gravação cena a cena e organiza produção, conteúdos e calendário — com planos Grátis/Pro e suporte interno.

**O que ela não faz:** não publica no TikTok, não edita vídeo e não mede vendas. A publicação é manual e o calendário é editorial.

---

## 2. Mapa de telas

| Rota | Acesso | O que entrega | Status |
|---|---|---|---|
| `/` | Pública | Landing com busca, exemplos, como funciona, 8 partes do plano, planos, FAQ e páginas legais | No ar |
| `/planos` | Pública | Comparativo Grátis × Pro × Enterprise, mensal/anual, vagas de lançamento, FAQ e checkout | No ar |
| `/termos`, `/privacidade`, `/reembolso` | Pública | Páginas legais | No ar |
| `/descobrir` (sem sessão) | Pública | Login, cadastro, recuperação e redefinição de senha | No ar |
| `/descobrir` | Creator | Dashboard: métricas, semana editorial, próximos conteúdos, gráficos e filtros de período | No ar |
| `/descobrir` | Creator | Busca conversacional, sugestões, filtros, comparação, histórico e planejador semanal | No ar |
| `/produtos/[productId]` | Creator | Produto, dados de comissão/vendas e roteiros salvos | No ar |
| `/produtos/[productId]/kits/[kitId]` | Creator | Plano de gravação completo + modo guiado | No ar |
| `/producao` | Creator | Produtos selecionados, status, busca, ordenação e publicação manual | No ar |
| `/conteudos` | Creator | Biblioteca de conteúdos/roteiros, filtros, cópia de gancho e agendamento | No ar |
| `/calendario` | Creator | Calendário mensal editorial com status e agendamento | No ar |
| `/conta` | Creator | Perfil, senha, preferências, voz, plano, cancelamento e exclusão | No ar |
| `/suporte` | Creator | Assistente de suporte com IA + conversas com o time | No ar |
| `/admin` | Admin | Visão geral, catálogo, creators, assinaturas, suporte, IA e funil | No ar |

> O admin é redirecionado para o painel e não usa as áreas de creator (`/calendario` e `/conteudos` mostram aviso de "área de creators").

---

## 3. Inventário por área

### 3.1 Aquisição e acesso

| Funcionalidade | Detalhe | Status |
|---|---|---|
| Landing pública | Hero com busca, exemplos de planos, "3 passos", 8 partes, carrossel, planos, FAQ e CTA | No ar |
| Busca que sobrevive ao login | Texto vai por `sessionStorage` + query string para `/descobrir` | No ar |
| Cadastro e login por e-mail | Conta criada com código de 6 dígitos por e-mail, reenvio e sessão persistida | No ar |
| Login social | Google, Facebook e Apple via Supabase OAuth | No ar |
| Recuperação de senha | Fluxo de envio de link e redefinição | No ar |
| Onboarding em 5 etapas | Objetivo, estilos, temas, "sua voz" (opcional) e conclusão | No ar |
| Personalização alimentando a IA | Temas viram atalhos/contexto na busca; a voz entra no roteiro | No ar |
| Bloqueio de creator | Admin bloqueia/reativa; creator bloqueado perde acesso | No ar |
| Exclusão de conta | Remove perfil e conteúdos, com confirmação | No ar |

**Observações**
- A sessão é persistida no navegador (`persistSession: true`), com refresh automático: recarregar, fechar e voltar depois mantém a conta conectada até o logout explícito ou a expiração do token.
- A troca de senha só aparece para contas com login por e-mail; contas OAuth têm a senha gerenciada pelo provedor.

---

### 3.2 Descoberta de produtos

| Funcionalidade | Detalhe | Status |
|---|---|---|
| Busca conversacional | IA interpreta o pedido e devolve até **5 produtos reais** do catálogo | No ar |
| Modos de descoberta | "Descobrir produtos", "Não sei o que vender" e "Planejar a semana" visíveis; "Criar conteúdo" existe por URL | Parcial |
| Busca por imagem | Upload de JPEG/PNG/WEBP (até 10 MB, redimensionado no cliente) para identificar o produto | No ar |
| Filtros rápidos | Preço (até R$ 50 / R$ 100) e nicho (Casa / Beleza) | No ar |
| Ordenação | Mais vendidos, menor preço e maior comissão | No ar |
| Comparação | Seleciona até 2 produtos e compara preço, comissão estimada e vendas lado a lado | No ar |
| Badges | "Maior comissão estimada" e "Mais vendido do grupo" | No ar |
| Filtro de categorias sensíveis | Oculta lingerie/moda íntima/adulto; preferência fica no navegador | No ar |
| Histórico de buscas | Lista as buscas recentes, reabre, remove uma ou limpa tudo | No ar |
| Motivo da recomendação | Texto com dados reais: preço, comissão, vendas, categoria e preferências | No ar |
| Preferências do creator | Temas do onboarding entram no ranking/motivo; a voz entra no roteiro | No ar |

**Limites e regras**
- A busca devolve no máximo 5 produtos por resposta.
- Categorias sensíveis recebem aviso de possível restrição de anúncio no TikTok.
- A IA pode pedir refinamento quando o pedido é vago; há atalhos de "por preço", "por nicho" e "fáceis de gravar".

---

### 3.3 Criação de conteúdo (kit)

| Funcionalidade | Detalhe | Status |
|---|---|---|
| Plano em 8 partes | Título, gancho, cenas, roteiro, legenda/copy, CTA, hashtags e áudio/duração | No ar |
| Cenas | Cenas sequenciadas com tempo, "mostre", "fale" e "ação/edição" (fallback usa 5 cenas) | No ar |
| Roteiro enriquecido | Roteiro principal + **3 variações de hook** + versão sem aparecer + dica de publicação + **5 variações de roteiro** | No ar |
| Direções prontas | 5 atalhos: direto ao ponto, até 15s, sem aparecer, recomendação natural e problema/solução | No ar |
| Briefing livre | Até 1.500 caracteres, com chips ("mostrar preço", "sem rosto", "falar de frete") | No ar |
| Voz personalizada | Até 500 caracteres no perfil; roteiros novos saem no jeito do creator | Pro |
| Reuso inteligente | Reabrir um produto reutiliza o kit existente; "gerar outra versão" cria um novo | No ar |
| Nova versão | Cooldown de 30s no Pro; consome 1 roteiro da cota | No ar |
| Fallback | Se a IA falhar, salva um roteiro base determinístico para gerar outra versão depois | No ar |
| Guardrails de conteúdo | CTA sem escassez/link externo, hashtags normalizadas, cenas vagas reparadas | No ar |

**Limites por plano**
- **Grátis:** 100 buscas/semana e 10 roteiros/semana; sem variações e sem voz personalizada; 1 roteiro por produto. A aba Produtos (catálogo completo) é exclusiva do Pro.
- **Pro:** ilimitado com uso justo interno de **1.000 kits/mês**; variações e voz incluídas.

---

### 3.4 Guia de gravação

| Funcionalidade | Detalhe | Status |
|---|---|---|
| Checklist "antes de gravar" | Itens de preparação marcáveis | No ar |
| Etapa de abertura | Escolha entre as variações de hook | No ar |
| Cena a cena | "Mostre", "Fale" e "Ação/edição" com progresso "X de Y cenas gravadas" | No ar |
| Marcar/desmarcar cena | Atualiza o status da produção | No ar |
| Copiar etapa ou plano | Copia o conteúdo de uma etapa ou o plano inteiro | No ar |
| Roteiro completo | Expansível com roteiro principal, hooks, variações, versão sem aparecer e dica de publicação | No ar |
| Gerar outra versão | Pede nova geração de IA a partir de uma ideia | No ar |
| Publicação | Quando gravado, mostra o material para copiar e o caminho para publicar | No ar |

---

### 3.5 Produção, conteúdos e calendário

| Funcionalidade | Detalhe | Status |
|---|---|---|
| Produtos selecionados | Lista os produtos salvos com status **salvo → em produção → gravado → publicado** | No ar |
| Busca, filtro e ordenação | Filtra por etapa, busca por nome e ordena pela próxima ação | No ar |
| Link do vídeo publicado | Campo opcional; valida domínio `tiktok.com` | No ar |
| Remover da produção | Remove o item com confirmação | No ar |
| Biblioteca de conteúdos | Métricas (na biblioteca, em produção, gravados, publicados), busca e filtros | No ar |
| Agendamento editorial | Data planejada por conteúdo (`scheduled_for`), editável | No ar |
| Copiar gancho | Copia o hook direto da lista | No ar |
| Calendário mensal | Navegação por mês, status coloridos e painel do dia | No ar |
| Dashboard | Períodos (hoje, mês, 30 dias, ano, tudo, personalizado), 5 métricas, gráficos e próximos conteúdos | No ar |
| Semana editorial | 7 dias com indicação de planejado e atalho para planejar | No ar |
| Planejador semanal | Monta até 7 dias de conteúdo e gera os kits em sequência | No ar |
| Central de notificações | Notificações in-app derivadas de plano e produção (sem push/e-mail) | Parcial |

**Importante:** o calendário e o status "publicado" são **editoriais**. A plataforma não publica no TikTok; o creator publica por fora e pode colar o link.

---

### 3.6 Conta

| Funcionalidade | Detalhe | Status |
|---|---|---|
| Perfil | Nome e dados básicos | No ar |
| Senha | Troca com confirmação da senha atual (contas e-mail) | No ar |
| Preferências | Temas/estilos usados como atalhos na descoberta | No ar |
| Sua voz | Até 500 caracteres; personaliza roteiros novos | Pro |
| Cartão do plano | Plano atual, status, renovação, uso de kits/buscas e preço de lançamento | No ar |
| Cancelamento | Cancela e mantém acesso até o fim do período pago | No ar |
| Troca de plano | Agendada para o próximo ciclo | No ar |
| Exclusão de conta | Remove perfil e conteúdos | No ar |
| Sair | Encerra a sessão | No ar |

---

### 3.7 Suporte

| Funcionalidade | Detalhe | Status |
|---|---|---|
| Assistente de suporte com IA | Responde dúvidas sobre a plataforma em 2–5 frases, com contexto do creator | No ar |
| Limite do assistente | 40 mensagens/dia por usuário (cota separada de buscas e kits) | No ar |
| Abertura de conversa | Categorias: dúvida, problema, cobrança, sugestão, outro | No ar |
| Conversas | Até 5 conversas ativas por creator; histórico e respostas | No ar |
| Encerramento | Creator pode fechar a conversa | No ar |
| Fila no admin | Admin vê, responde e altera status | No ar |
| Fallback | Sem chave de IA, orienta abrir conversa com o time | Condicionado |

**Guardrails:** a IA de suporte não inventa preço/prazo, não promete vendas e trata a mensagem do usuário como dado, não como instrução.

---

### 3.8 Painel administrativo

| Funcionalidade | Detalhe | Status |
|---|---|---|
| Visão geral | 9 indicadores: creators, produtos, kits, publicações, suporte, assinaturas, uso de IA etc. | No ar |
| Saúde do catálogo | Produtos prontos para descoberta | No ar |
| Creators | Lista, nicho, status e bloqueio/reativação | No ar |
| Catálogo | CRUD de produtos, upload de imagem (5 MB; JPEG/PNG/WEBP/GIF) e export CSV | No ar |
| Assinaturas | Resumo e lista de assinaturas (espelho do provedor) | No ar |
| Suporte | Fila de conversas, resposta e status | No ar |
| Uso de IA | Consumo operacional e métricas de tokens | No ar |
| Funil | Eventos de produto dos últimos 30 dias | No ar |

**Observação:** o CSV disponível hoje é o do catálogo (admin). O creator não tem exportação dos próprios dados.

---

### 3.9 Billing e planos

| Funcionalidade | Detalhe | Status |
|---|---|---|
| Catálogo de planos | Grátis, Pro (lançamento e padrão) e Enterprise | No ar |
| Checkout | Cartão recorrente ou PIX/pré-pago, conforme disponibilidade | Condicionado |
| Vagas de lançamento | 100 vagas com preço de lançamento; reserva atômica no Postgres | Condicionado |
| Cancelamento | Mantém acesso até o fim do período | Condicionado |
| Troca de plano | Agendada para o próximo ciclo | Condicionado |
| Webhook | Autenticado por segredo (`x-webhook-secret` ou query), idempotente | Condicionado |
| Gating por plano | Buscas, kits, variações, voz e itens de produção | No ar (Grátis sempre; Pro depende do billing) |
| Direito de arrependimento | 7 dias (CDC), via suporte | No ar (política) |

**Preços vigentes**

| Plano | Mensal | Anual | Regra |
|---|---:|---:|---|
| Grátis | R$ 0 | R$ 0 | 100 buscas/semana e 10 roteiros/semana; 1 item na produção; sem catálogo completo, voz ou variações |
| Pro — Lançamento (encerrado) | R$ 39,90 | R$ 399 | Só renovações de assinantes antigos; novas vendas usam o preço cheio |
| Pro — Padrão | R$ 49,90 | R$ 499 | Ilimitado com uso justo de 1.000 kits/mês |
| Enterprise | Sob consulta | Sob consulta | Condições definidas em conversa |
| ~~Essencial~~ | — | — | Aposentado; só assinaturas legadas |
| ~~Scale~~ | — | — | Aposentado; só assinaturas legadas |

- O anual equivale a **10 meses** (2 meses grátis).
- **Não existe trial.** O plano Grátis não renova automaticamente.
- **Não existe avulso.** O antigo pacote de kits foi removido.

**Quando o billing está desligado (`BILLING_ENABLED=false`)**
- O checkout fica indisponível e a página de planos avisa.
- Os limites do **Grátis continuam valendo** (100 buscas/semana, 10 roteiros/semana, 1 item, sem catálogo, voz ou variações).
- Usuários pagos não sofrem o teto de uso justo enquanto a flag estiver desligada.

---

### 3.10 Analytics e telemetria

| Funcionalidade | Detalhe | Status |
|---|---|---|
| Eventos de funil | Lista fechada de 19 eventos (landing, signup, onboarding, busca, kit, checkout, publicado etc.) | No ar |
| Rastreio de páginas | Landing e planos disparam eventos de visualização | No ar |
| Funil no admin | Agregação dos últimos 30 dias | No ar |
| Métricas de IA | Tokens, latência e cache por operação | No ar |
| Privacidade | Lista fechada de eventos e props limitadas a 1.000 caracteres | No ar |

---

### 3.11 IA e infraestrutura

| Item | Detalhe | Status |
|---|---|---|
| Provedor principal | Gemini 3.1 Flash-Lite | No ar |
| Fallback de IA | OpenRouter (modelo free) e fallback determinístico sem IA | No ar |
| Cache | Classificação 30 min; resposta de busca 10 min; catálogo 5 min | No ar |
| Busca por imagem | Análise visual com guardrails (não identifica pessoas/marcas; ignora instruções na imagem) | No ar |
| Escopo do assistente | Suporte só responde sobre a TemTrend: base de fatos fechada + recusa determinística de tema externo antes de chamar a IA (sem gastar cota) | No ar |
| Banco/Auth/Storage | Supabase (RLS, service role, bucket de imagens) | No ar |
| Frontend | Next.js 16 + React 19 (Vercel) | No ar |
| Backend | Fastify (Render) | No ar |
| E-mail marketing | Resend (série de boas-vindas/eventos) | Condicionado |
| Migrations | 001 a 045 no repositório; schema necessário aplicado no projeto verificado em 13/11/2026 | No ar |

**Rate limits técnicos**
- Busca de IA: 10/min.
- Geração de kit: 12/min (o planejador semanal gera até 7 em sequência).
- Suporte: 20/min.
- Global: 200/min.
- Ações sensíveis (senha/exclusão): 5/min.

---

## 4. Limites e cotas (resumo operacional)

| Item | Grátis | Pro | Enterprise |
|---|---:|---:|---:|
| Buscas de IA | 100/semana | Ilimitado (uso justo interno de 1.000/dia) | Customizado |
| Kits/roteiros | 10/semana | Ilimitado (uso justo de 1.000/mês) | Customizado |
| Variações de roteiro | Não | Sim (cooldown 30s) | Sim |
| Voz personalizada | Não | Sim | Sim |
| Roteiros por produto | 1 | Ilimitado | Ilimitado |
| Itens na produção | 1 | Ilimitado | Ilimitado |
| Assistente de suporte | 40 msgs/dia | 40 msgs/dia | 40 msgs/dia |
| Suporte humano | In-app | In-app | In-app (condições sob consulta) |

> O número de 1.000 kits/mês é **interno** (proteção contra abuso). Não aparece na tabela de planos; ao atingir, a conversa é comercial.

---

## 5. O que não existe hoje

Isso evita promessa errada em venda, suporte e parceria:

- **Publicação automática no TikTok** — o creator publica por fora e pode colar o link.
- **Edição/renderização de vídeo** — a plataforma entrega roteiro e guia, não o arquivo final.
- **Métricas de desempenho do vídeo** (views, vendas, receita) — o dashboard mede o funil interno de status.
- **Integração de afiliados/TikTok Shop API** — o catálogo mostra comissão estimada, não repassa comissão.
- **Multiusuário, assentos ou workspace de agência**.
- **Exportação de dados pelo creator** (o CSV é só do catálogo no admin).
- **App mobile nativo** — a experiência é web responsiva.
- **Notificações push/e-mail transacionais de produto** — a central é in-app e derivada; o Resend cobre marketing.
- **Trial de 7 dias** — o modelo atual é Plano Grátis + Pro.
- **Plano avulso** — removido.
- **Checkout Enterprise** — sob consulta via suporte.
- **Agendamento de publicação** — o calendário é editorial.
- **Colaboração/aprovação de roteiro**.
- **Busca por voz e multi-idioma** (produto em pt-BR).

---

## 6. Dependências e flags

| Variável | Efeito se faltar |
|---|---|
| `BILLING_ENABLED` | Checkout desligado; página de planos avisa; limites do Grátis continuam |
| `ABACATEPAY_API_KEY` | Não cria checkout |
| `ABACATEPAY_WEBHOOK_SECRET` | Webhook recusa tudo (503) e nenhum plano é liberado |
| IDs `ABACATEPAY_PRODUCT_*` | Produto específico não é encontrado no checkout |
| `GEMINI_API_KEY` | Cai para OpenRouter; sem ambos, fallback determinístico |
| `OPENROUTER_API_KEY` | Sem fallback de IA |
| `AI_QUOTA_STORE=database` | Cota persistida no Postgres (recomendado em produção) |
| `RESEND_API_KEY` / `RESEND_AUDIENCE_ID` | Sem contatos/eventos de marketing |
| `CATALOG_FEED_URL` / `CATALOG_FEED_TOKEN` | Sem sincronização automática do catálogo FastMoss |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | API não sobe |

---

## 7. Pontos de atenção para o time

1. **Migrations em dia.** O repositório vai até `045` e o schema necessário ao código atual foi verificado no projeto Supabase em 13/11/2026 (`scheduled_for`, `support_calls`, `shared_conversations`, cota semanal e funções do suporte). O `docs/relatorio-precificacao.md` mantém seções históricas (trial, Essencial/Scale) marcadas como tal.
2. **Planos legados no código.** `essencial` e `scale` continuam em `PLAN_LIMITS` e `LEGACY_PRODUCTS` apenas para assinaturas antigas. Não comercializar.
3. **Métrica "Trial" no admin.** Existe no resumo por compatibilidade, mas não há fluxo de trial sendo vendido.
4. **Uso justo é interno.** Se o creator bater 1.000 kits/mês, o atendimento precisa saber que a saída é conversa comercial, não upgrade de plano.
5. **Publicação é manual.** Evitar frases como "publica no TikTok" em copy, suporte e parceria.
6. **Central de notificações é in-app.** Não há push nem e-mail transacional de produção/vencimento.
7. **"Criar conteúdo" está latente.** O contexto existe (`/descobrir?context=create`), mas não há entrada visível na navegação; hoje o fluxo principal é Descobrir → produto → roteiro.
8. **Admin não usa a área de creator.** Para testar a jornada do creator é preciso uma conta não-admin.
9. **Billing desligado não libera o Grátis.** Os limites gratuitos definidos em `plans.ts` e 1 item continuam valendo; só o teto de uso justo dos pagos é ignorado.
10. **Suporte com IA depende de chave.** Sem `GEMINI_API_KEY`/`OPENROUTER_API_KEY`, o assistente responde com fallback e orienta abrir conversa.

---

## 8. Smoke test rápido (interno)

1. Abrir `/` e buscar um produto; conferir que a busca chega em `/descobrir` após o login.
2. Criar conta nova e concluir o onboarding; conferir temas e voz no retorno.
3. Esgotar a cota gratuita de buscas e kits; conferir o bloqueio do Grátis. Tentar abrir a aba Produtos e conferir o paywall do catálogo.
4. Abrir um kit, marcar cenas como gravadas e copiar o plano.
5. Agendar uma data em `/conteudos` e conferir no `/calendario`.
6. Marcar como publicado com e sem link do TikTok.
7. Em `/conta`, conferir o cartão do plano e o uso de kits/buscas.
8. Abrir `/suporte`, testar o assistente e abrir uma conversa.
9. Em `/planos`, conferir preços de lançamento, anual e checkout (quando habilitado).
10. No admin, conferir catálogo, creators, assinaturas, suporte e funil.

---

## 9. Referências de código

- Rotas e telas: `frontend/app/`
- Componentes da plataforma: `frontend/components/platform/`
- Planos e gating: `backend/src/modules/billing/plans.ts` e `billing.gating.ts`
- Assistente e IA: `backend/src/modules/assistant/`
- Conteúdo/produção: `backend/src/modules/creator-content/`
- Suporte: `backend/src/modules/support/`
- Admin: `backend/src/modules/admin/`
- Analytics: `backend/src/modules/analytics/analytics.routes.ts`
- Schema: `backend/supabase/migrations/` (001–035)
