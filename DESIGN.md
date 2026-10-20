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

O lima é a única cor de marca. Status de erro, aviso e sucesso precisam de texto e ícone além da cor. As cores acima são tokens de `frontend/styles/canonical.css`: `--tt-ink`, `--tt-lime`, `--tt-lime-soft`, `--tt-deep`, `--tt-canvas`, `--tt-surface`, `--tt-soft`, `--tt-line`, `--tt-muted` e `--tt-danger`. Para hover de ação primária, usar `--tt-lime-hover`; para superfícies de erro e sucesso, `--tt-danger-soft` e `--tt-success-soft`.

## Tipografia

- Inter Tight é a fonte de leitura e interface. Fustat é usada em títulos, inclusive no app. Ambas são carregadas localmente pelo Next.js; a escolha das famílias segue a referência tipográfica oficial da AbacatePay, sem reproduzir sua identidade visual.
- Título principal: `clamp(2.7rem, 5.5vw, 5.5rem)`, peso 650–750, entrelinha próxima de 1 e espaçamento negativo moderado.
- Títulos de seção: `clamp(2rem, 4vw, 4rem)`. Subtítulos de cartões: 1.15–1.5rem.
- Texto corrido: pelo menos 1rem na landing e 0.875rem em áreas densas da plataforma. Metadados podem chegar a 0.75rem, nunca viram o único modo de entender uma ação.
- Números de preço, comissão, vendas e progresso usam algarismos tabulares. Parágrafos longos têm largura máxima de aproximadamente 65 caracteres.
- Em CSS, usar `--tt-font-ui` para leitura e controles e `--tt-font-editorial` para títulos. Tamanhos recorrentes: `--tt-text-xs`, `--tt-text-sm`, `--tt-text-body` e `--tt-text-card-title`. Não introduzir outra família tipográfica em componentes novos.

## Layout e componentes

- Largura de leitura da landing: até 1240px. Área operacional: até 1200px. Recuo lateral mínimo: 20px no celular.
- Espaçamento em escala de 4, 8, 12, 16, 24, 32, 48, 72 e 96px.
- Botões principais são limas com tinta escura; ações secundárias usam superfície branca e borda; ações terciárias são links de texto claros.
- Raios de borda seguem uma hierarquia fixa: `--tt-radius-sm` (detalhes internos, 8px), `--tt-radius-control` (campos e controles, 12px), `--tt-radius-card` (cartões, 20px), `--tt-radius-panel` (seções amplas e diálogos, 28px) e `--tt-radius-pill` (botões, chips e navegação, 999px). No celular, cartões e painéis reduzem para 18px e 22px. Círculos funcionais, como avatares, podem usar 50%.
- Altura mínima de controles: `--tt-control-height` (48px); alvos de toque compactos: `--tt-touch-height` (44px). Foco de teclado usa `--tt-deep` e não depende só da cor de fundo. Transições rápidas usam `--tt-motion-fast` e respeitam movimento reduzido.
- Campos mostram rótulo permanente, estado de foco visível, erro junto ao campo e toque de pelo menos 44px.
- Catálogo: foto, nome, categoria e métricas com rótulos explícitos. Ação de roteiro recebe a ênfase; salvar e detalhes permanecem distinguíveis.
- Cartões só delimitam unidades de conteúdo reais. Evitar caixa dentro de caixa e painéis sem função.
- No marketing, alternar blocos editoriais, fotografia de creators e demonstrações do produto. Na plataforma, usar fundo estável e densidade controlada.
- Termos, privacidade, erro e página não encontrada usam a mesma marca, leitura confortável e uma saída clara para continuar a navegação.

## Contrato para componentes novos

`frontend/styles/canonical.css`, importado por último em `frontend/app/layout.tsx`, é a fonte única dos tokens e dos contratos globais. Um componente novo deve reutilizar esses tokens, sem copiar valores hexadecimais, fontes ou raios para seu CSS. Estilos de composição e layout ficam no arquivo do componente; ajustes globais ficam na camada canônica. Não criar novos arquivos de “fix”, “polish” ou “override”.

| Elemento | Tratamento obrigatório |
| --- | --- |
| Ação principal | Fundo e borda `--tt-lime`, texto `--tt-ink`, raio `--tt-radius-pill`; hover `--tt-lime-hover` |
| Ação secundária | `--tt-surface`, borda `--tt-line`, texto `--tt-ink`, mesmo raio da primária |
| Ação destrutiva | `--tt-danger` com rótulo explícito; nunca usar lima |
| Campo | Fonte `--tt-font-ui`, raio `--tt-radius-control`, rótulo permanente e foco visível |
| Cartão | Superfície `--tt-paper` ou `--tt-surface`, borda `--tt-line`, raio `--tt-radius-card` |
| Painel ou diálogo | Raio `--tt-radius-panel`; ações e campos seguem os contratos acima |
| Chip ou status | Raio `--tt-radius-pill`; texto/ícone indicam o estado além da cor |

Antes de concluir uma tela nova, verificar os estados normal, hover, pressionado, foco, desabilitado, carregando, vazio e erro, além de celular e teclado. Exceções visuais precisam representar uma função ou estado específico, não preferência isolada de um componente.

## Responsividade e movimento

- A navegação principal continua acessível por teclado e toque. No celular, o formulário de busca e sua ação ocupam a largura disponível sem truncar o texto digitado.
- Grades passam a duas colunas e depois uma, conforme o espaço real do conteúdo. Nenhuma etapa exige rolagem horizontal da página.
- Animações usam `transform` e `opacity`, duram em geral 180–300ms e respeitam `prefers-reduced-motion`. Carrosséis automáticos oferecem pausa.
- O conteúdo de cada seção permanece visível antes de qualquer animação ou rolagem; movimento nunca condiciona a leitura.
- Links de salto, foco visível, nomes acessíveis, texto alternativo e contraste legível são requisitos de todas as telas.

## Linguagem

Usar português do Brasil, frases diretas e verbos específicos: “Encontrar produtos”, “Gerar roteiro”, “Salvar produto”. Mostrar a próxima ação em estados vazios e de erro. Não insinuar que a plataforma publica o vídeo automaticamente ou garante vendas.

Fotos e produtos usados para ilustrar a landing devem ser identificados como exemplos. O nome mostrado precisa corresponder ao objeto na foto, e uma chamada para cadastro não deve sugerir acesso direto a um item específico quando isso não ocorre.
