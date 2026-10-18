import type { Metadata } from "next";
import Link from "next/link";
import LegalPageFrame from "@/components/legal/LegalPageFrame";

export const metadata: Metadata = {
  title: "Termos de Uso | TemTrend",
  description:
    "Regras de uso da TemTrend: o que a plataforma entrega, teste grátis, planos, renovação, cancelamento, direito de arrependimento (CDC) e responsabilidades.",
};

export default function TermosPage() {
  return (
    <LegalPageFrame
      eyebrow="Uso da plataforma"
      title="Termos de Uso"
      updated="18 de outubro de 2026"
      intro="As regras entre você e a TemTrend: o que a plataforma entrega, como funcionam o teste grátis, os planos e o cancelamento, seus direitos como consumidor e os limites de responsabilidade de cada lado."
    >
      <section aria-labelledby="termos-aceitacao">
        <h2 id="termos-aceitacao">Aceitação e abrangência</h2>
        <p>Estes Termos de Uso (“Termos”) regulam a relação entre você e a TemTrend (“TemTrend”, “nós”) no uso da plataforma disponível em <strong>temtrend.online</strong> (“Plataforma”), incluindo o site, a área logada, o catálogo de produtos, a geração de roteiros e as ferramentas de produção.</p>
        <p>Ao criar a conta, iniciar o teste grátis ou contratar um plano, você declara que leu, entendeu e aceita estes Termos, a <Link href="/privacidade">Política de Privacidade</Link> e a <Link href="/reembolso">Política de Reembolso</Link>, que juntos formam o contrato entre as partes. O aceite é eletrônico, feito depois que os documentos ficam disponíveis para leitura — como exige o Decreto nº 7.962/2013.</p>
        <p>Se você não concordar com alguma cláusula, não crie conta nem contrate. Dúvidas são atendidas pelo <strong>Suporte</strong> dentro da Plataforma.</p>
      </section>

      <section aria-labelledby="termos-servico">
        <h2 id="termos-servico">O que a TemTrend é — e o que não é</h2>
        <p>A TemTrend é uma ferramenta de trabalho para creators de conteúdo. Ela ajuda você a:</p>
        <ul>
          <li><strong>descobrir produtos</strong> a partir de um catálogo com preço, comissão estimada e sinais de tendência;</li>
          <li><strong>gerar Content Kits</strong> — planos de gravação com roteiro, cenas, legenda, hashtags, áudio e duração, com apoio de inteligência artificial;</li>
          <li><strong>organizar a produção</strong> do roteiro até a publicação, com registro dos links publicados.</li>
        </ul>
        <p>Para evitar qualquer dúvida, a TemTrend <strong>não é</strong>:</p>
        <ul>
          <li>marketplace: não vende produtos, não intermedia vendas e não processa pagamentos de compradores;</li>
          <li>afiliada, patrocinada ou endossada pelo TikTok, pelo TikTok Shop ou por qualquer loja citada no catálogo — essas marcas pertencem a seus titulares e são mencionadas apenas para indicar onde você publica;</li>
          <li>ferramenta de publicação automática: não grava, não edita e não publica vídeos, e não armazena seus vídeos;</li>
          <li>garantia de resultado: não prometemos vendas, comissões, visualizações, aprovação em programas de afiliados ou viralização;</li>
          <li>consultoria jurídica, contábil, fiscal ou de marketing.</li>
        </ul>
      </section>

      <section aria-labelledby="termos-catalogo">
        <h2 id="termos-catalogo">Catálogo e dados de terceiros</h2>
        <p>O catálogo reúne informações obtidas de fontes públicas e de parceiros. Preço, comissão, volume de vendas e disponibilidade são <strong>referências informativas</strong>, podem estar desatualizados e mudam sem aviso nas plataformas de origem. Quando disponível, a data de referência aparece junto ao produto.</p>
        <p>Antes de gravar ou publicar, confirme oferta, estoque, preço, regras de afiliado e requisitos do programa diretamente na plataforma de destino. A decisão sobre o que criar e publicar é sempre sua.</p>
      </section>

      <section aria-labelledby="termos-conta">
        <h2 id="termos-conta">Conta e elegibilidade</h2>
        <p>Para usar a Plataforma você precisa ter <strong>18 anos ou mais</strong> e capacidade civil (ou ser emancipado, nos termos do Código Civil). Ao se cadastrar, você confirma que atende a esses requisitos e que as informações fornecidas são verdadeiras, exatas e suas.</p>
        <ul>
          <li>É permitida <strong>uma conta por pessoa</strong>. Os assentos adicionais previstos em planos específicos (como o Scale) devem ser usados pela mesma equipe ou empresa, nunca revendidos a terceiros.</li>
          <li>Você é responsável por manter sua senha em segurança e por toda atividade realizada na sua conta. Se suspeitar de acesso indevido, avise o Suporte imediatamente.</li>
          <li>Cadastros com dados falsos, incompletos ou de terceiros podem ser recusados ou bloqueados.</li>
        </ul>
      </section>

      <section aria-labelledby="termos-trial">
        <h2 id="termos-trial">Teste grátis</h2>
        <p>Novas contas podem começar com <strong>7 dias do plano Pro, sem cartão de crédito</strong> e sem cobrança automática. O teste é liberado uma única vez por pessoa e não é cumulativo.</p>
        <ul>
          <li>Ao fim do teste, a conta passa para o modo gratuito: você continua acessando a conta e tudo o que criou, mas as funções com limite por plano ficam indisponíveis até a contratação.</li>
          <li>Criar contas em série para repetir o teste é uso indevido (cláusula “Uso aceitável”) e pode levar ao bloqueio.</li>
          <li>Desistir do teste antes do fim não gera nenhuma cobrança.</li>
        </ul>
      </section>

      <section aria-labelledby="termos-planos">
        <h2 id="termos-planos">Planos, preços e formas de pagamento</h2>
        <p>Os planos pagos são <strong>Essencial</strong>, <strong>Pro</strong> e <strong>Scale</strong> (cobrança mensal ou anual) e <strong>Enterprise</strong> (condições sob consulta). Os valores vigentes nesta versão dos Termos são:</p>
        <ul>
          <li><strong>Essencial</strong>: R$ 29,90 por mês ou R$ 299,00 por ano;</li>
          <li><strong>Pro</strong>: R$ 59,90 por mês ou R$ 599,00 por ano;</li>
          <li><strong>Scale</strong>: R$ 149,00 por mês ou R$ 1.490,00 por ano.</li>
        </ul>
        <p>No plano anual, quando indicado, você paga o equivalente a 10 meses e usa 12. A página <Link href="/planos">Planos</Link> é a fonte atualizada de preços, limites e recursos — e o valor, a periodicidade e os limites aplicáveis são sempre os exibidos no momento da contratação.</p>
        <ul>
          <li>Os pagamentos são processados por parceiro especializado (AbacatePay), por PIX ou cartão. <strong>Não armazenamos os dados completos do seu cartão</strong>.</li>
          <li>Limites de uso (buscas de IA por dia, kits de conteúdo por mês e outros) constam do plano contratado e podem ser ampliados quando você muda de plano.</li>
          <li>O comprovante da compra é enviado por email; documentos fiscais seguem a legislação aplicável e podem ser solicitados pelo Suporte.</li>
          <li>Preços podem ser ajustados, mas <strong>nunca retroativamente</strong>: o período já pago é respeitado e o novo valor vale a partir do ciclo seguinte, com aviso prévio pelos canais da Plataforma.</li>
        </ul>
      </section>

      <section aria-labelledby="termos-renovacao">
        <h2 id="termos-renovacao">Renovação automática</h2>
        <p>As assinaturas são <strong>recorrentes</strong>: ao fim de cada ciclo (mensal ou anual), a cobrança é renovada automaticamente, pelo mesmo meio de pagamento, no valor informado na contratação ou no valor atualizado que tenha sido comunicado com antecedência.</p>
        <ul>
          <li>A data da próxima renovação fica sempre visível na sua conta, em Conta → Plano.</li>
          <li>Para não renovar, cancele antes da data de renovação — o cancelamento impede qualquer cobrança seguinte.</li>
          <li>Se uma cobrança não for concluída, o acesso às funções pagas pode ser suspenso até a regularização, sem apagar seus dados.</li>
          <li>Renovações involuntárias ou com erro de cobrança têm tratamento na <Link href="/reembolso">Política de Reembolso</Link>.</li>
        </ul>
      </section>

      <section aria-labelledby="termos-cancelamento">
        <h2 id="termos-cancelamento">Cancelamento e mudança de plano</h2>
        <p>Você pode <strong>cancelar a assinatura a qualquer momento</strong>, sem multa e sem precisar justificar, direto na conta (Conta → Plano). O cancelamento interrompe novas cobranças e você mantém o acesso até o fim do período já pago.</p>
        <ul>
          <li>Depois do período pago, a conta passa para o modo gratuito. <strong>Nada é apagado</strong>: seus roteiros, produtos salvos e itens de produção continuam salvos para quando você quiser voltar.</li>
          <li>Mudanças de plano (upgrade ou downgrade) são agendadas para o próximo ciclo, com o ajuste de valor e a data exibidos na conta.</li>
          <li>Valores já pagos seguem a <Link href="/reembolso">Política de Reembolso</Link>, inclusive o direito de arrependimento de 7 dias.</li>
        </ul>
      </section>

      <section aria-labelledby="termos-arrependimento">
        <h2 id="termos-arrependimento">Direito de arrependimento e reembolsos</h2>
        <p>Nas compras feitas pela internet, o Código de Defesa do Consumidor (art. 49) garante a você <strong>7 dias para desistir</strong> da contratação, sem justificar o motivo, com <strong>devolução integral</strong> dos valores pagos — na primeira compra de plano mensal ou anual, mesmo que você já tenha usado o serviço nesse período.</p>
        <ul>
          <li>O pedido é feito pelo <strong>Suporte → Cobrança</strong>, o mesmo canal de atendimento da compra, como prevê o art. 5º do Decreto nº 7.962/2013.</li>
          <li>Depois dos 7 dias, o cancelamento segue a cláusula anterior e as devoluções são analisadas nos casos da <Link href="/reembolso">Política de Reembolso</Link>.</li>
          <li>Falhas e vícios do serviço têm tratamento próprio nos arts. 18 a 20 do CDC. Nenhuma cláusula destes Termos reduz direitos assegurados ao consumidor por lei.</li>
        </ul>
      </section>

      <section aria-labelledby="termos-uso">
        <h2 id="termos-uso">Uso aceitável</h2>
        <p>Você se compromete a usar a Plataforma de forma leal e dentro da lei. É proibido, entre outros:</p>
        <ul>
          <li>raspar, copiar ou extrair dados da Plataforma ou do catálogo por meios automatizados, ou contornar limites de plano, bloqueios e medições de uso;</li>
          <li>fazer engenharia reversa, copiar, revender, sublicenciar ou alugar a Plataforma, o catálogo ou os roteiros como produto ou template próprio;</li>
          <li>usar os roteiros ou o catálogo para treinar modelos de inteligência artificial ou para construir serviço concorrente;</li>
          <li>manter múltiplas contas para repetir testes gratuitos ou burlar limites;</li>
          <li>acessar dados de outros usuários ou áreas administrativas, ou tentar comprometer a segurança da Plataforma;</li>
          <li>publicar conteúdo ilícito, enganoso, discriminatório, que viole direitos de imagem, autorais ou de marca, ou que desrespeite as regras da plataforma de destino;</li>
          <li>prometer renda ou resultados garantidos em conteúdo baseado em roteiros da TemTrend — prática que pode configurar publicidade enganosa (art. 37 do CDC).</li>
        </ul>
        <p>O descumprimento pode levar a aviso, limitação, suspensão ou encerramento da conta, sem prejuízo das medidas legais cabíveis.</p>
      </section>

      <section aria-labelledby="termos-ia">
        <h2 id="termos-ia">Roteiros e conteúdo gerado por inteligência artificial</h2>
        <p>Os roteiros são gerados por inteligência artificial a partir dos dados do produto e das informações que você fornece. A IA pode errar: pode criar alegações imprecisas, repetir dados desatualizados do catálogo ou sugerir abordagens que não combinam com você.</p>
        <ul>
          <li><strong>Revise sempre antes de publicar</strong>, incluindo preços, características do produto, benefícios e chamadas.</li>
          <li>O conteúdo que você grava e publica é de sua responsabilidade: veracidade das afirmações, identificação de publicidade quando for o caso, direitos de imagem e música, e cumprimento das regras da plataforma de destino.</li>
          <li>Não use os roteiros para afirmar o que você não pode comprovar — propaganda enganosa é ilícita (art. 37 do CDC) e pode gerar responsabilidade para você e para a marca envolvida.</li>
        </ul>
      </section>

      <section aria-labelledby="termos-propriedade">
        <h2 id="termos-propriedade">Conteúdo e propriedade intelectual</h2>
        <p><strong>Da TemTrend:</strong> a marca, o visual, o código, a organização do catálogo e os materiais dos roteiros são protegidos por direitos de propriedade intelectual. Nós concedemos a você uma licença pessoal, limitada, não exclusiva e revogável para usar os roteiros na produção do seu próprio conteúdo, enquanto sua conta estiver ativa. Nada nestes Termos transfere para você a titularidade da Plataforma.</p>
        <p><strong>Seu:</strong> seus dados de perfil, sua voz, seus ajustes, seus links e os vídeos que você grava são seus. Você nos concede uma licença limitada para armazenar e processar esse conteúdo apenas para operar o serviço, conforme a <Link href="/privacidade">Política de Privacidade</Link>.</p>
        <p>Roteiros gerados a partir de dados públicos podem ser semelhantes entre usuários — não garantimos exclusividade sobre ideias ou roteiros. Sugestões que você enviar podem ser usadas para melhorar a Plataforma, sem obrigação de remuneração ou confidencialidade.</p>
      </section>

      <section aria-labelledby="termos-disponibilidade">
        <h2 id="termos-disponibilidade">Disponibilidade, evolução e versões beta</h2>
        <p>Trabalhamos para manter a Plataforma disponível e estável, mas ela pode ficar temporariamente fora do ar por manutenção, falhas de fornecedores (autenticação, inteligência artificial, pagamentos, hospedagem) ou eventos fora do nosso controle. Versões beta e planos padrão não têm SLA contratual; acordos específicos de nível de serviço podem ser firmados à parte, por exemplo no Enterprise.</p>
        <ul>
          <li>Podemos adicionar, alterar ou descontinuar funcionalidades para evoluir o produto e proteger a estabilidade — mudanças que reduzam direitos relevantes seguem a cláusula “Comunicações e alterações”.</li>
          <li>Limites diários e mensais protegem a estabilidade e o custo da operação; planos com “fair use” são acompanhados e podem ser ajustados em caso de uso anormal.</li>
        </ul>
      </section>

      <section aria-labelledby="termos-encerramento">
        <h2 id="termos-encerramento">Suspensão e encerramento</h2>
        <p><strong>Por você:</strong> é possível encerrar a conta a qualquer momento em Conta → Excluir conta. A exclusão é permanente e remove perfil e conteúdos salvos, conforme a <Link href="/privacidade">Política de Privacidade</Link>. Se houver assinatura ativa, cancele o plano antes de excluir a conta para não haver qualquer cobrança futura.</p>
        <p><strong>Por nós:</strong> podemos suspender ou encerrar contas em caso de violação destes Termos, fraude, risco à segurança, ordem de autoridade ou reclamação fundamentada de terceiros. Sempre que possível, avisamos antes e damos chance de correção; em situações graves, o bloqueio pode ser imediato.</p>
        <ul>
          <li>Se encerrarmos o serviço ou a sua conta sem que você tenha dado causa, o valor correspondente ao período pago e não utilizado é devolvido proporcionalmente.</li>
          <li>Sobrevivem ao encerramento as cláusulas de propriedade intelectual, responsabilidade, lei aplicável e as demais que, pela natureza, devam continuar valendo.</li>
        </ul>
      </section>

      <section aria-labelledby="termos-responsabilidade">
        <h2 id="termos-responsabilidade">Responsabilidade</h2>
        <p>Nós respondemos pelos vícios e falhas do serviço nos termos do Código de Defesa do Consumidor (arts. 18 a 20), e este documento não exclui responsabilidade por dolo, culpa grave ou por direitos que a lei assegura a você — cláusulas com esse efeito seriam nulas (art. 51 do CDC).</p>
        <p>Não somos responsáveis por:</p>
        <ul>
          <li>dados do catálogo de terceiros, que são informativos e sujeitos a mudança nas plataformas de origem;</li>
          <li>conteúdo que você grava, publica ou deixa de publicar, nem por decisões comerciais tomadas por você;</li>
          <li>indisponibilidade ou mudanças nas plataformas de destino (como o TikTok Shop), nos programas de afiliados ou nos produtos anunciados;</li>
          <li>lucros cessantes e danos indiretos, na máxima extensão permitida pela legislação aplicável;</li>
          <li>caso fortuito e força maior.</li>
        </ul>
        <p>Na extensão permitida em lei, nossa responsabilidade total por danos diretos fica limitada ao valor efetivamente pago por você nos 12 meses anteriores ao evento.</p>
      </section>

      <section aria-labelledby="termos-comunicacoes">
        <h2 id="termos-comunicacoes">Comunicações e alterações dos Termos</h2>
        <p>Enviamos comunicações transacionais (segurança, cobrança, alterações relevantes) para o email da sua conta e por avisos na Plataforma — estas são necessárias à relação contratual. Mensagens de conteúdo e novidades são opcionais e podem ser desativadas.</p>
        <p>Podemos atualizar estes Termos para refletir mudanças legais, técnicas ou do produto. A versão vigente é sempre a publicada nesta página, com data de atualização. Mudanças relevantes são avisadas pelos canais da Plataforma com antecedência razoável; se a mudança reduzir direitos seus, você pode cancelar antes que ela passe a valer, com as devoluções cabíveis. O uso continuado depois da entrada em vigor significa concordância.</p>
      </section>

      <section aria-labelledby="termos-atendimento">
        <h2 id="termos-atendimento">Atendimento, lei aplicável e foro</h2>
        <p>Dúvidas, reclamações e pedidos são atendidos pelo <strong>Suporte</strong> dentro da Plataforma, nas categorias Dúvida, Problema, Cobrança, Sugestão e Outro. Prazos de resposta variam por plano: Essencial em até 48h, Pro em até 24h e Scale com atendimento dedicado.</p>
        <p>Você também pode recorrer aos canais oficiais de defesa do consumidor, como a plataforma <strong>consumidor.gov.br</strong> e o Procon do seu estado.</p>
        <p>Estes Termos são regidos pelas leis brasileiras, em especial o Código de Defesa do Consumidor (Lei nº 8.078/1990), o Marco Civil da Internet (Lei nº 12.965/2014) e a Lei Geral de Proteção de Dados (Lei nº 13.709/2018). Para consumidores, é competente o foro do domicílio da pessoa consumidora (art. 101, I, do CDC). Se alguma cláusula for considerada inválida, as demais permanecem em vigor.</p>
      </section>
    </LegalPageFrame>
  );
}
