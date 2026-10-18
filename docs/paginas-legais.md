# Páginas legais — Termos de Uso, Privacidade e Reembolso

**Atualizado em:** 18/10/2026
**Páginas:** `/termos`, `/privacidade`, `/reembolso` (novas versões completas, pt-BR)

## O que foi entregue

| Página | Arquivo | Conteúdo |
|---|---|---|
| Termos de Uso | `frontend/app/termos/page.tsx` | 17 seções: aceitação, descrição do serviço, catálogo de terceiros, conta, trial, planos/preços, renovação, cancelamento, arrependimento, uso aceitável, IA, propriedade intelectual, disponibilidade/beta, suspensão, responsabilidade, comunicações, atendimento/foro |
| Política de Privacidade | `frontend/app/privacidade/page.tsx` | 12 seções LGPD: dados tratados, finalidades e bases legais (art. 7º), cookies/armazenamento, IA, compartilhamento (operadores), transferência internacional, retenção, segurança, direitos (art. 18), menores, alterações |
| Política de Reembolso | `frontend/app/reembolso/page.tsx` | 12 seções: resumo, base legal, prazo de 7 dias, como pedir, devolução do dinheiro, efeitos na conta, cancelamento pós-7 dias, plano anual, renovações, falhas/cobranças indevidas, documentos fiscais, atendimento |

Links adicionados: rodapé legal (`LegalPageFrame`), rodapé da landing (`landing-rebuild.tsx`), rodapé de `/planos` (`PricingPage.tsx`), chip "7 dias de arrependimento (CDC)" e FAQ em `/planos`, aviso no modal de cancelamento da conta (`Account.tsx`).

## Bases legais aplicadas

- **CDC (Lei nº 8.078/1990)** — art. 49 (arrependimento de 7 dias + parágrafo único: devolução imediata e monetariamente atualizada), art. 51 (nulidade de cláusulas abusivas), arts. 18–20 (vícios do serviço), art. 37 (publicidade enganosa), art. 101, I (foro do consumidor).
- **Decreto nº 7.962/2013** — art. 4º (informações claras) e art. 5º (arrependimento pelo mesmo canal de atendimento da compra).
- **LGPD (Lei nº 13.709/2018)** — arts. 7º (bases legais), 18–19 (direitos e prazo de 15 dias), 33–36 (transferência internacional), 46–48 (segurança e incidentes).
- **Marco Civil da Internet (Lei nº 12.965/2014)** — art. 15 (registros de acesso, quando aplicável).
- **Código Civil** — capacidade civil e emancipação no cadastro.

## Decisões de redação (postura proconsumidor, de propósito)

1. **7 dias contados da confirmação do pagamento da primeira contratação**, com reembolso integral **mesmo com uso** no período (leitura literal do art. 49).
2. **Plano anual**: dentro de 7 dias → integral; depois → cancelamento com acesso até o fim dos 12 meses, sem devolução proporcional como regra, **exceto** falhas, erros de cobrança e análise de boa-fé (caso a caso).
3. **Renovação automática**: se cobrada e o novo ciclo não foi usado, devolução integral em até 7 dias da cobrança (política de boa-fé alinhada ao art. 49).
4. **Cobrança após cancelamento / duplicada / divergente** → devolução imediata, sem prazo.
5. **Encerramento unilateral pela TemTrend sem causa** → devolução proporcional do período não usado (cláusula nos Termos).
6. Sem CNPJ/endereço físico por decisão do momento (ver pendências).

## Pendências e recomendações (validar com advogado/contador)

- [ ] **CNPJ + endereço físico/endereço eletrônico**: o art. 4º do Decreto nº 7.962/2013 exige nome empresarial, CNPJ/CPF e endereço do fornecedor. Hoje as páginas trazem apenas a marca "TemTrend" e o Suporte interno como canal. Incluir assim que a empresa estiver formalizada.
- [ ] **Canal externo para titulares/DPO**: hoje só há o Suporte in-app (exigência de cadastro). Para pedidos LGPD de quem não tem conta, avaliar e-mail público (ex.: `privacidade@temtrend…`).
- [ ] **Emails de renovação**: a política assume que a data da renovação aparece na conta; o ideal (boa prática e menos disputa) é enviar aviso antes da cobrança anual — hoje não implementado (`docs/go-live-billing.md`, seção 6).
- [ ] **Marketing (Resend)**: a Política trata comunicações de relacionamento como consentimento. O código atual adiciona contatos à audiência no cadastro — avaliar checkbox de opt-in no signup ou reenquadrar como legítimo interesse com opt-out claro.
- [ ] **Nota fiscal por assinatura/cancelamento**: alinhar emissão (e reflexo de estornos) com o contador.
- [ ] **Revisão anual** ou a cada mudança relevante de preço/produto; atualizar a data "Última atualização" nas três páginas.

## Onde alterar conteúdo

- Textos: arquivos das páginas acima (componentes `<section>` numerados por CSS — a ordem exibida segue a ordem do JSX).
- Rodapé legal: `frontend/components/legal/LegalPageFrame.tsx`.
- Data de atualização: prop `updated` em cada página.
