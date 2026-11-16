# Mapa da plataforma — TemTrend

**Atualizado em:** 13/11/2026
**Como ler:** cada bloco mostra a rota, o que o usuário faz e o que o sistema entrega por trás.

## 1. Visão em uma frase

A TemTrend leva o creator de **“o que eu vendo?”** até **“vídeo gravado e organizado”**: descobre produtos reais do TikTok Shop, gera um plano de gravação em 8 partes, guia a gravação cena a cena e organiza produção, conteúdos e calendário. A publicação é **manual**.

## 2. Fluxo principal

```
Landing (/)
  └─ CTA "Começar grátis" → /descobrir?mode=signup
       └─ Cadastro (nome, e-mail, senha) → código de 6 dígitos no e-mail
            └─ Login automático → Onboarding (objetivo, estilos, temas, voz)
                 └─ Descobrir (/descobrir)
                      ├─ busca por texto, imagem ou "não sei o que vender"
                      ├─ IA devolve até 5 produtos reais com preço/comissão/vendas
                      ├─ salvar produto → Produção (/producao)
                      └─ gerar roteiro → Plano de gravação (/produtos/[id]/kits/[kitId])
                           ├─ 8 partes: conceito, abertura, cenas, roteiro, legenda, CTA, hashtags, áudio/duração
                           ├─ modo guiado: preparar → gravar abertura → gravar cenas → marcar gravado
                           └─ marcar publicado (link do TikTok opcional)
                 └─ Meus conteúdos (/conteudos) → biblioteca por status + agendamento
                      └─ Calendário (/calendario) → visão mensal editorial
```

## 3. Rotas públicas

| Rota | Nome/título | O que entrega |
|---|---|---|
| `/` | TemTrend — Produtos e roteiros para o TikTok Shop | Landing: hero, como funciona, exemplo de plano em 8 partes, planos, FAQ e formulário para marcas |
| `/planos` | Planos e preços | Comparativo Grátis × Pro × Enterprise, ciclo mensal/anual, checkout PIX ou cartão |
| `/termos` | Termos de Uso | Regras, planos, renovação, cancelamento, arrependimento e responsabilidades |
| `/privacidade` | Política de Privacidade | LGPD: dados, finalidades, operadores, retenção, direitos e segurança |
| `/reembolso` | Política de Reembolso | 7 dias de arrependimento, cancelamento e devoluções |

Essas são as únicas rotas indexáveis. Todas têm canonical, Open Graph, Twitter Card e a imagem OG gerada no build.

## 4. Entrada e conta

| Rota | Acesso | O que faz |
|---|---|---|
| `/descobrir` | Público até autenticar | Sem sessão: login, cadastro e recuperação. Com sessão: busca conversacional |
| `/conta` | Creator | Perfil, senha, plano, cancelamento, exclusão e logout |
| `/conta/planos` | Creator | Plano atual, troca de ciclo, checkout PIX/cartão e renovação |
| `/preferencias` | Creator | Objetivo, estilos, temas e “sua voz” (voz é recurso Pro) |

**Cadastro:** a API cria o usuário no Supabase sem sessão, envia um código de 6 dígitos pelo Resend e só libera o login depois da confirmação. A sessão fica persistida no navegador.

**Recuperação:** código de 6 dígitos por e-mail; contas Google entram pelo Google.

## 5. Descoberta

| Rota | O que faz |
|---|---|
| `/descobrir` | Busca conversacional, filtros (preço/nicho), comparação de até 2 produtos, sugestões e histórico |
| `/descobrir/[sessionId]` | Reabre uma conversa do histórico com os turnos e produtos originais |
| `/produtos` | Catálogo completo com busca, categorias e ordenação — **exclusivo do Pro** |
| `/produtos/[productId]` | Detalhe do produto, métricas e roteiros já salvos |
| `/compartilhar/[slug]` | Link de uma conversa compartilhada; quem abre pode importar o roteiro |

**Por trás:** a IA classifica a intenção usando um recorte do catálogo, ranqueia localmente por preço/comissão/vendas e devolve no máximo 5 produtos. Há cache de classificação/resposta e fallback determinístico se o provedor falhar.

## 6. Roteiro e gravação

| Rota | O que faz |
|---|---|
| `/produtos/[productId]/kits/[kitId]` | Plano em 8 partes + modo guiado de gravação |

**O plano contém:** conceito, abertura (hook), cenas com tempo/mostre/fale/ação, roteiro principal, 3 variações de hook, versão sem aparecer, 5 variações de roteiro, legenda, CTA, hashtags, áudio sugerido e duração.

**Modo guiado:** checklist “antes de gravar”, escolha do hook, cena a cena com progresso, cópia por etapa/plano e botões para marcar gravado/publicado.

## 7. Produção, conteúdos e calendário

| Rota | O que faz |
|---|---|
| `/producao` | Pipeline `salvo → em produção → gravado → publicado`, com busca, filtro e link do vídeo |
| `/conteudos` | Biblioteca por status (para gravar/gravados/publicados), busca e agendamento |
| `/calendario` | Calendário mensal editorial; a data é planejada, não publica sozinho |

A publicação é **manual**: o creator grava fora da plataforma e pode colar o link do TikTok.

## 8. Resultados e suporte

| Rota | O que faz |
|---|---|
| `/resultados` | Prévia do futuro painel de views/vendas/comissão; hoje registra interesse |
| `/suporte` | Assistente de IA com base de fatos fechada + abertura de conversa com o time |

O assistente de suporte responde só sobre a TemTrend, não inventa preço/prazo e recusa assuntos externos antes de gastar cota.

## 9. Administração

| Rota | Acesso | O que faz |
|---|---|---|
| `/admin` | Admin | Visão geral, catálogo (CRUD/upload/CSV), creators (ficha com plano e uso), leads de marca, assinaturas, suporte e uso de IA |

O painel usa abas com link direto (`/admin#produtos`, `#creators`, `#leads`,
`#billing`, `#support`, `#ai`). O catálogo é paginado e filtrado no servidor
(`GET /admin/products?q=&status=&categoria=&sort=&page=&limit=`) e o CSV respeita
os mesmos filtros (`GET /admin/products/export`). Leads da landing de marcas são
lidos em `GET /admin/leads` e qualificados em `PATCH /admin/leads/:id/status`.

Planos (`#creators` / `#billing`): a lista mostra quem tem plano pago ativo e a
data de validade; `PATCH /admin/creators/:id/plan` concede Pro por 30/365 dias
(ou período livre) e espelha uma assinatura `provider=manual`, sem cobrança.
Excluir conta (`DELETE /admin/creators/:id`) exige o e-mail exato, cancela a
assinatura ativa nos provedores e apaga o usuário do Supabase (cascata em
perfil, roteiros, conversas, produções e tickets).

Suporte (`#support`): fila com contagem por status, busca por assunto,
paginação, resposta e transições (respondida, resolvida, encerrada, reabrir).

O admin é redirecionado para o painel e não usa as áreas de creator. Para testar a jornada do creator, use uma conta comum.

## 10. Monetização

| Plano | Preço | Limites |
|---|---|---|
| Grátis | R$ 0 | 100 buscas/semana, 10 roteiros/semana, 1 roteiro por produto, 1 item na produção, catálogo completo bloqueado, sem voz e sem variações |
| Pro | R$ 49,90/mês ou R$ 499/ano | Buscas e kits sem contagem visível; catálogo completo, voz e variações; uso justo interno de 1.000 kits/mês e 1.000 buscas/dia |
| Enterprise | Sob consulta | Condições definidas em conversa |

**Pagamento:** PIX/assinatura pela AbacatePay; cartão recorrente pelo Asaas. Webhooks idempotentes ativam, renovam e cancelam. O cancelamento mantém acesso até o fim do período pago.

## 11. O que acontece por trás de cada ação

| Ação do usuário | Backend | Banco/IA |
|---|---|---|
| Criar conta | `POST /auth/signup` | Supabase Auth + código HMAC no Postgres + Resend |
| Confirmar código | `POST /auth/verify-code` | consome código, confirma e-mail e libera login |
| Buscar produto | `POST /assistant/products` | cota → IA → ranqueamento → cache/histórico |
| Gerar roteiro | `POST /products/:id/content-kit` | cota → IA com guardrails → `content_kits` |
| Salvar na produção | `POST /creator-content` | cria/reutiliza kit, consome cota só se gerar |
| Agendar | `PATCH /creator-content/:id` | `scheduled_for` |
| Marcar status | `PATCH /creator-content/:id` | pipeline editorial + evento de analytics |
| Assinar | `POST /billing/checkout` | AbacatePay (PIX) ou Asaas (cartão) |
| Pagar | webhook do provedor | ativa/renova assinatura, idempotente |
| Falar no suporte | `POST /support/chat` | cota própria de 40/dia + base de fatos |
| Abrir conversa | `POST /support/tickets` | fila no admin + mensagens |

## 12. Mapa de estados

```
Conta:        sem sessão → autenticado → onboarding completo → creator ativo
Plano:        Grátis → Pro ativo → past_due → cancelado (acesso até o fim do período) → Grátis
Conteúdo:     salvo → em produção → gravado → publicado
Assinatura:   pendente → ativa → renovada | falha/past_due | cancelada
Roteiro:      gerado por IA | fallback determinístico | versão nova (cooldown 30s no Pro)
```

## 13. O que a plataforma NÃO faz

- Não publica no TikTok automaticamente.
- Não edita/renderiza vídeo.
- Não mede views, vendas ou comissão reais (Resultados é prévia).
- Não integra a API de afiliados do TikTok Shop.
- Não tem app mobile nativo, multiusuário/assentos ou exportação de dados pelo creator.
- Não garante vendas, comissões ou viralização.
