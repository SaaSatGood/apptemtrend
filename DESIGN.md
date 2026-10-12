# TemTrend — sistema de design

Este arquivo descreve a interface da TemTrend. A marca e os dados do produto têm prioridade sobre qualquer referência externa. A estrutura foi informada pelo [DESIGN.md de Wise](https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/wise/DESIGN.md), da coleção Awesome DESIGN.md, e adaptada às telas e à identidade já existentes.

## Direção

TemTrend ajuda creators brasileiros a escolher produtos, montar um plano de gravação e acompanhar a publicação. A interface deve passar clareza e impulso para agir, sem prometer vendas garantidas. O marketing pode ser expressivo; descoberta, produção, conta e administração devem favorecer leitura e decisão.

## Cores

| Papel | Valor | Uso |
| --- | --- | --- |
| Tinta | `#10110f` | Texto principal, botões escuros |
| Lima | `#c8ff2e` | Ação primária, marca, foco visual pontual |
| Lima claro | `#f2ffcb` | Seleção e realce suave |
| Verde profundo | `#385400` | Foco visível, links em fundo claro |
| Papel | `#fbfcf8` | Fundo geral |
| Superfície | `#ffffff` | Formulários e áreas de trabalho |
| Superfície suave | `#f4f6ef` | Seções alternadas e estados neutros |
| Linha | `#dce3d3` | Divisórias e bordas discretas |
| Texto secundário | `#4f574b` | Descrições e metadados |
| Erro | `#a52727` | Erros e ações destrutivas |

O lima é a única cor de marca. Status de erro, aviso e sucesso precisam de texto e ícone além da cor.

## Tipografia

- Manrope é a fonte de leitura e interface. Instrument Serif itálica acentua uma expressão curta em títulos de marketing e descoberta.
- Título principal: `clamp(2.7rem, 5.5vw, 5.5rem)`, peso 650–750, entrelinha próxima de 1 e espaçamento negativo moderado.
- Títulos de seção: `clamp(2rem, 4vw, 4rem)`. Subtítulos de cartões: 1.15–1.5rem.
- Texto corrido: pelo menos 1rem na landing e 0.875rem em áreas densas da plataforma. Metadados podem chegar a 0.75rem, nunca viram o único modo de entender uma ação.
- Números de preço, comissão, vendas e progresso usam algarismos tabulares. Parágrafos longos têm largura máxima de aproximadamente 65 caracteres.

## Layout e componentes

- Largura de leitura da landing: até 1240px. Área operacional: até 1200px. Recuo lateral mínimo: 20px no celular.
- Espaçamento em escala de 4, 8, 12, 16, 24, 32, 48, 72 e 96px.
- Botões principais são limas com tinta escura; ações secundárias usam superfície branca e borda; ações terciárias são links de texto claros.
- Campos mostram rótulo permanente, estado de foco visível, erro junto ao campo e toque de pelo menos 44px.
- Catálogo: foto, nome, categoria e métricas com rótulos explícitos. Ação de roteiro recebe a ênfase; salvar e detalhes permanecem distinguíveis.
- Cartões só delimitam unidades de conteúdo reais. Evitar caixa dentro de caixa e painéis sem função.
- No marketing, alternar blocos editoriais, fotografia de creators e demonstrações do produto. Na plataforma, usar fundo estável e densidade controlada.
- Termos, privacidade, erro e página não encontrada usam a mesma marca, leitura confortável e uma saída clara para continuar a navegação.

## Responsividade e movimento

- A navegação principal continua acessível por teclado e toque. No celular, o formulário de busca e sua ação ocupam a largura disponível sem truncar o texto digitado.
- Grades passam a duas colunas e depois uma, conforme o espaço real do conteúdo. Nenhuma etapa exige rolagem horizontal da página.
- Animações usam `transform` e `opacity`, duram em geral 180–300ms e respeitam `prefers-reduced-motion`. Carrosséis automáticos oferecem pausa.
- O conteúdo de cada seção permanece visível antes de qualquer animação ou rolagem; movimento nunca condiciona a leitura.
- Links de salto, foco visível, nomes acessíveis, texto alternativo e contraste legível são requisitos de todas as telas.

## Linguagem

Usar português do Brasil, frases diretas e verbos específicos: “Encontrar produtos”, “Gerar roteiro”, “Salvar produto”. Mostrar a próxima ação em estados vazios e de erro. Não insinuar que a plataforma publica o vídeo automaticamente ou garante vendas.

Fotos e produtos usados para ilustrar a landing devem ser identificados como exemplos. O nome mostrado precisa corresponder ao objeto na foto, e uma chamada para cadastro não deve sugerir acesso direto a um item específico quando isso não ocorre.
