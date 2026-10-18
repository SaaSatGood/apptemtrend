import type { Metadata } from "next";
import Link from "next/link";
import LegalPageFrame from "@/components/legal/LegalPageFrame";

export const metadata: Metadata = {
  title: "Política de Reembolso | TemTrend",
  description:
    "Direito de arrependimento de 7 dias (art. 49 do CDC), cancelamento a qualquer momento e devolução de valores em assinaturas mensais e anuais da TemTrend.",
};

export default function ReembolsoPage() {
  return (
    <LegalPageFrame
      eyebrow="Compras e assinaturas"
      title="Política de Reembolso"
      updated="18 de outubro de 2026"
      intro="O que acontece se você desistir da compra: o direito de arrependimento de 7 dias do Código de Defesa do Consumidor, o cancelamento a qualquer momento e como o dinheiro volta."
    >
      <section aria-labelledby="reembolso-resumo">
        <h2 id="reembolso-resumo">Resumo em 30 segundos</h2>
        <ul>
          <li><strong>Primeira compra (mensal ou anual):</strong> você tem 7 dias para desistir e receber 100% do valor de volta, sem precisar justificar — direito de arrependimento do art. 49 do CDC.</li>
          <li><strong>Depois dos 7 dias:</strong> cancele quando quiser, sem multa. Você mantém o acesso até o fim do período já pago e nada é apagado.</li>
          <li><strong>Renovação automática:</strong> se você for cobrado na renovação e não tiver usado o novo ciclo, pode pedir a devolução em até 7 dias da cobrança.</li>
          <li><strong>Erro de cobrança ou cobrança duplicada:</strong> devolvemos assim que confirmado, independentemente de prazo.</li>
          <li><strong>Como pedir:</strong> Suporte dentro da Plataforma, categoria <strong>Cobrança</strong>.</li>
        </ul>
      </section>

      <section aria-labelledby="reembolso-base">
        <h2 id="reembolso-base">Base legal</h2>
        <p>Esta política aplica os seguintes dispositivos, entre outros:</p>
        <ul>
          <li><strong>Código de Defesa do Consumidor (Lei nº 8.078/1990)</strong>, art. 49: nas contratações fora do estabelecimento comercial — inclusive pela internet — o consumidor pode desistir do contrato no prazo de 7 dias, e os valores pagos são devolvidos de imediato e atualizados monetariamente (art. 49, parágrafo único).</li>
          <li><strong>Decreto nº 7.962/2013</strong>, arts. 4º e 5º: o fornecedor deve informar de forma clara os meios de arrependimento, e o consumidor pode exercê-lo pelo mesmo canal de atendimento em que fez o pedido.</li>
          <li><strong>CDC, art. 51:</strong> são nulas cláusulas que suprimam direitos do consumidor, inclusive a opção de reembolso nos casos previstos em lei.</li>
        </ul>
        <p>Nada nesta política reduz direitos assegurados pela legislação consumerista. Em caso de dúvida de interpretação, prevalece a leitura mais favorável a você, consumidor.</p>
      </section>

      <section aria-labelledby="reembolso-prazo">
        <h2 id="reembolso-prazo">O prazo de 7 dias</h2>
        <p>Na <strong>primeira contratação</strong> de qualquer plano — mensal ou anual — você tem <strong>7 dias corridos</strong> para desistir, contados da confirmação do pagamento, quando o contrato é celebrado e o acesso é liberado. Esse marco é o mais favorável a você e é o que adotamos.</p>
        <ul>
          <li>Não é necessário justificar o motivo.</li>
          <li>O direito é integral <strong>mesmo que você já tenha usado o serviço</strong> dentro dos 7 dias — buscas, kits gerados e roteiros salvos não reduzem o valor devolvido.</li>
          <li>Vale igualmente para o <strong>plano anual</strong>: dentro dos 7 dias, a devolução é de 100% do valor pago.</li>
          <li>Renovações automáticas têm regra própria de boa-fé no item “Renovações”.</li>
        </ul>
      </section>

      <section aria-labelledby="reembolso-pedido">
        <h2 id="reembolso-pedido">Como pedir</h2>
        <p>O pedido é simples e feito dentro da Plataforma, pelo <strong>mesmo canal de atendimento usado na compra</strong> (art. 5º do Decreto nº 7.962/2013):</p>
        <ul>
          <li>entre na sua conta e abra <strong>Suporte</strong>;</li>
          <li>crie uma nova conversa na categoria <strong>Cobrança</strong>;</li>
          <li>informe o email da conta e, se possível, o comprovante da compra. Se preferir, escreva apenas “quero exercer o direito de arrependimento”.</li>
        </ul>
        <p>Confirmamos o recebimento do pedido e conduzimos o processo pelo próprio Suporte, mantendo você informado até a conclusão.</p>
      </section>

      <section aria-labelledby="reembolso-devolucao">
        <h2 id="reembolso-devolucao">Como e quando o dinheiro volta</h2>
        <p>A devolução é <strong>integral</strong>: todos os valores pagos na contratação, a qualquer título, são devolvidos <strong>de imediato</strong> e, quando aplicável, atualizados monetariamente, na forma do art. 49, parágrafo único, do CDC. Não descontamos taxas pelo exercício do arrependimento.</p>
        <ul>
          <li><strong>PIX:</strong> a devolução é feita para a mesma titularidade (mesmo CPF/CNPJ do pagamento), em regra no mesmo dia útil e em até 5 dias úteis, conforme o processador de pagamentos.</li>
          <li><strong>Cartão de crédito:</strong> o estorno é solicitado ao processador imediatamente. O crédito aparece na sua fatura conforme os prazos da rede emissora do cartão, normalmente em até 1 ou 2 ciclos de fatura.</li>
          <li><strong>Divergência de titularidade:</strong> quando o pagamento não puder voltar pelo mesmo meio, combinamos com você uma forma segura de devolução pelo Suporte.</li>
        </ul>
        <p>O comprovante da devolução fica disponível pelo Suporte e os registros seguem o item “Comprovantes e documentos fiscais”.</p>
      </section>

      <section aria-labelledby="reembolso-conta">
        <h2 id="reembolso-conta">O que acontece com sua conta e seus conteúdos</h2>
        <p>Ao concluir o reembolso:</p>
        <ul>
          <li>o acesso às funções do plano é encerrado e a conta volta ao modo gratuito;</li>
          <li>o que você criou permanece salvo, conforme a Política de Privacidade — você pode voltar a assinar quando quiser e retomar de onde parou;</li>
          <li>se preferir não manter nada, você pode excluir a conta em Conta → Excluir conta; a exclusão remove perfil e conteúdos e é irreversível.</li>
        </ul>
      </section>

      <section aria-labelledby="reembolso-cancelamento">
        <h2 id="reembolso-cancelamento">Cancelamento depois dos 7 dias</h2>
        <p>Passado o prazo de arrependimento, você continua podendo <strong>cancelar a qualquer momento</strong>, sem multa e sem justificar, em Conta → Plano. O cancelamento:</p>
        <ul>
          <li>interrompe todas as cobranças futuras;</li>
          <li>mantém o acesso às funções do plano até o fim do período já pago;</li>
          <li>preserva seus dados e conteúdos.</li>
        </ul>
        <p>Como o serviço permanece à sua disposição até o fim do período contratado, não há, como regra, devolução proporcional de períodos já iniciados além do prazo de arrependimento — mas situações específicas descritas nesta política (falhas do serviço, erros de cobrança e análise de boa-fé) são sempre consideradas. Fale com o Suporte antes de desistir de usar: grande parte dos casos tem solução.</p>
      </section>

      <section aria-labelledby="reembolso-anual">
        <h2 id="reembolso-anual">Plano anual</h2>
        <ul>
          <li><strong>Dentro dos 7 dias:</strong> devolução integral, mesmo que você já tenha usado a plataforma no período.</li>
          <li><strong>Depois dos 7 dias:</strong> o cancelamento interrompe a renovação e você mantém acesso até o fim dos 12 meses contratados. Como o anual equivale a 10 meses pagos e 12 de uso, períodos já iniciados não têm, como regra, devolução proporcional.</li>
          <li><strong>Análise de boa-fé:</strong> se ocorrer algo fora do comum — indisponibilidade relevante do serviço, cobrança em duplicidade, renovação não pretendida ou erro de cobrança — peça o reembolso pelo Suporte. Analisamos caso a caso, com prioridade, e devolvemos o valor proporcional sempre que a situação justificar.</li>
        </ul>
      </section>

      <section aria-labelledby="reembolso-renovacoes">
        <h2 id="reembolso-renovacoes">Renovações automáticas</h2>
        <p>Assinaturas são recorrentes: a data da próxima cobrança fica visível na sua conta (Conta → Plano). Para não renovar, basta cancelar antes dessa data.</p>
        <p>Se a renovação acontecer e você não pretendia continuar, fale com o Suporte <strong>em até 7 dias da cobrança</strong>. Aplicamos, por boa-fé e alinhamento ao espírito do art. 49 do CDC, a devolução integral da renovação sempre que você <strong>não tiver usado o novo ciclo</strong> (sem novas buscas ou kits gerados no período). Se já houve uso, o acesso segue válido até o fim do novo ciclo e o cancelamento continua disponível a qualquer momento.</p>
      </section>

      <section aria-labelledby="reembolso-falhas">
        <h2 id="reembolso-falhas">Falhas do serviço, cobranças indevidas e erros</h2>
        <ul>
          <li><strong>Vícios e falhas:</strong> se o serviço apresentar problemas que o tornem inadequado ao uso previsto, você pode pedir a correção ou a devolução, proporcional ou integral, conforme o caso, nos termos dos arts. 18 a 20 do CDC. A análise é prioritária.</li>
          <li><strong>Cobrança duplicada, valor divergente do contratado ou cobrança após cancelamento:</strong> confirmada a inconsistência, devolvemos o valor integral imediatamente, independentemente de prazos.</li>
          <li><strong>Chargeback:</strong> seu direito de contestar a cobrança junto ao banco ou emissor do cartão é preservado. Se fizer isso, avise o Suporte em paralelo para agilizar a solução; durante uma disputa, recursos podem ser temporariamente limitados para evitar uso indevido, e tudo é regularizado assim que a situação for resolvida.</li>
        </ul>
      </section>

      <section aria-labelledby="reembolso-fiscal">
        <h2 id="reembolso-fiscal">Comprovantes e documentos fiscais</h2>
        <p>Você recebe o comprovante da compra por email, e o Suporte fornece cópias quando precisar. Eventuais documentos fiscais são emitidos conforme a legislação aplicável e refletem os cancelamentos e devoluções realizados.</p>
      </section>

      <section aria-labelledby="reembolso-atendimento">
        <h2 id="reembolso-atendimento">Atendimento e seus direitos</h2>
        <p>Compromissos de atendimento para pedidos desta política:</p>
        <ul>
          <li>pedidos de arrependimento e cobranças indevidas são tratados com prioridade pelo Suporte (categoria Cobrança);</li>
          <li>confirmamos o recebimento e mantemos você informado em cada etapa até a devolução;</li>
          <li>prazos gerais de resposta por plano: Essencial em até 48h, Pro em até 24h e Scale com atendimento dedicado.</li>
        </ul>
        <p>Se você não ficar satisfeito com a solução, pode recorrer à plataforma <strong>consumidor.gov.br</strong>, ao Procon do seu estado, ao Juizado Especial Cível ou à Justiça Comum. Para consumidores, é competente o foro do seu domicílio (art. 101, I, do CDC).</p>
        <p>Este documento faz parte do contrato com a TemTrend, junto dos <Link href="/termos">Termos de Uso</Link> e da <Link href="/privacidade">Política de Privacidade</Link>, e pode ser atualizado para refletir mudanças na legislação ou no serviço, sempre com a versão vigente publicada nesta página e data de atualização visível.</p>
      </section>
    </LegalPageFrame>
  );
}
