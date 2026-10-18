import type { Metadata } from "next";
import Link from "next/link";
import LegalPageFrame from "@/components/legal/LegalPageFrame";

export const metadata: Metadata = {
  title: "Política de Privacidade | TemTrend",
  description:
    "Como a TemTrend trata dados pessoais conforme a LGPD: dados coletados, finalidades, bases legais, compartilhamento, retenção e seus direitos como titular.",
};

export default function PrivacidadePage() {
  return (
    <LegalPageFrame
      eyebrow="Seus dados"
      title="Política de Privacidade"
      updated="18 de outubro de 2026"
      intro="Como a TemTrend trata dados pessoais, com base na Lei Geral de Proteção de Dados: o que coletamos, por quê, com quem compartilhamos, por quanto tempo guardamos e como você exerce seus direitos."
    >
      <section aria-labelledby="privacidade-controlador">
        <h2 id="privacidade-controlador">Quem trata seus dados</h2>
        <p>A <strong>TemTrend</strong> (“TemTrend”, “nós”) é a <strong>controladora</strong> dos dados pessoais tratados na plataforma disponível em <strong>temtrend.online</strong> (“Plataforma”). Esta política vale para quem visita o site, cria conta, usa o teste grátis ou contrata um plano.</p>
        <p>Nosso canal para assuntos de privacidade e para o exercício de direitos, incluindo a atuação do encarregado (DPO), é o <strong>Suporte dentro da Plataforma</strong>: abra uma conversa com o assunto “Privacidade”. Para pedidos de titulares, respondemos em até 15 dias, na forma do art. 19 da LGPD.</p>
      </section>

      <section aria-labelledby="privacidade-dados">
        <h2 id="privacidade-dados">Dados que tratamos</h2>
        <p>Coletamos o mínimo necessário para operar o serviço, em cinco grupos:</p>
        <ul>
          <li><strong>Cadastro e identificação:</strong> nome, email, provedor de login (email/senha ou contas como Google, Apple e Facebook, conforme sua escolha) e credenciais de acesso, armazenadas de forma protegida pelo provedor de autenticação.</li>
          <li><strong>Perfil e preferências:</strong> temas de interesse, plataformas em que você publica, se possui conta de afiliado, preferências de conteúdo e o campo opcional “Sua voz” (um trecho de exemplo de como você fala, com até 500 caracteres).</li>
          <li><strong>Uso da Plataforma:</strong> buscas realizadas, produtos vistos e salvos, Content Kits gerados e suas versões, itens da área Produção e links de publicação que você registra.</li>
          <li><strong>Plano e cobrança:</strong> plano contratado, período, status de pagamento e identificadores de cobrança recebidos do processador de pagamentos. <strong>Não temos acesso ao número completo do seu cartão nem ao código de segurança</strong> — esses dados ficam com o processador especializado.</li>
          <li><strong>Suporte e técnicos:</strong> conversas de suporte e mensagens; logs de acesso (endereço IP, data e hora, navegador) usados para segurança e prevenção a abuso; e eventos de uso da interface (página, ação e identificador da conta quando você está logado) usados em métricas internas.</li>
        </ul>
        <p><strong>O que não tratamos:</strong> não armazenamos vídeos — a gravação acontece fora da TemTrend. Também não temos finalidade para dados pessoais sensíveis (art. 5º, II, da LGPD). Evite inseri-los em qualquer campo da Plataforma, inclusive no exemplo de voz.</p>
      </section>

      <section aria-labelledby="privacidade-finalidades">
        <h2 id="privacidade-finalidades">Finalidades e bases legais</h2>
        <p>Tratamos dados pessoais somente para finalidades específicas, com as bases legais do art. 7º da LGPD:</p>
        <ul>
          <li><strong>Executar o contrato (inciso V):</strong> criar e manter sua conta, personalizar a descoberta de produtos, gerar roteiros, organizar sua produção e processar assinaturas e cobranças.</li>
          <li><strong>Cumprir obrigações legais (inciso II):</strong> registros fiscais, contábeis e respostas a autoridades competentes.</li>
          <li><strong>Legítimo interesse (inciso IX):</strong> segurança da Plataforma, prevenção a fraude e uso abusivo, aplicação de limites de uso e melhoria do produto com métricas agregadas ou pseudonimizadas.</li>
          <li><strong>Consentimento (inciso I):</strong> comunicações de conteúdo, novidades e relacionamento, que você pode recusar ou interromper a qualquer momento.</li>
          <li><strong>Exercício regular de direitos (inciso VI):</strong> defesa em processos administrativos ou judiciais.</li>
        </ul>
      </section>

      <section aria-labelledby="privacidade-cookies">
        <h2 id="privacidade-cookies">Cookies, armazenamento local e medição de uso</h2>
        <ul>
          <li><strong>Não usamos cookies de publicidade nem rastreamento entre sites</strong> de terceiros.</li>
          <li>Utilizamos armazenamento local necessário ao funcionamento: sessão de login (mantida pelo provedor de autenticação), preferências técnicas e um marcador de primeiro acesso usado para medir a ativação do produto.</li>
          <li>A medição de uso é feita de forma primária, nos nossos próprios servidores, com o identificador da sua conta quando você está logado. As métricas são usadas para entender o funil do produto e melhorar a experiência.</li>
          <li>Você pode limpar o armazenamento do navegador a qualquer momento — isso encerra a sessão e reinicia as medições locais.</li>
        </ul>
      </section>

      <section aria-labelledby="privacidade-ia">
        <h2 id="privacidade-ia">Uso de inteligência artificial</h2>
        <p>As buscas e a geração de roteiros contam com provedores de inteligência artificial (em regra, Google Gemini; conforme a configuração, outros provedores como OpenRouter). Enviamos a esses provedores apenas o necessário para a tarefa: o texto da sua busca, informações do produto, suas preferências e, se você preencheu, o trecho do campo “Sua voz”.</p>
        <ul>
          <li>Os provedores processam os dados conforme seus próprios termos e políticas de privacidade, e buscamos parceiros com compromissos de segurança e, quando aplicável, cláusulas contratuais de proteção.</li>
          <li><strong>Não usamos seus roteiros nem seus dados para treinar modelos próprios</strong>, e não autorizamos esse uso por parte dos provedores.</li>
          <li>Você pode editar ou remover o campo “Sua voz” na sua conta a qualquer momento.</li>
          <li>Recomendação: não insira dados sensíveis nem dados de terceiros nesses campos.</li>
        </ul>
      </section>

      <section aria-labelledby="privacidade-compartilhamento">
        <h2 id="privacidade-compartilhamento">Compartilhamento</h2>
        <p><strong>Não vendemos seus dados</strong> e não os compartilhamos para publicidade. O compartilhamento acontece apenas com operadores que nos ajudam a operar o serviço, sempre com acesso limitado ao necessário:</p>
        <ul>
          <li><strong>Supabase</strong> — autenticação, banco de dados e armazenamento;</li>
          <li><strong>AbacatePay</strong> — processamento de pagamentos e assinaturas;</li>
          <li><strong>Provedores de inteligência artificial</strong> (Google e, quando configurado, OpenRouter) — interpretação de buscas e geração de roteiros;</li>
          <li><strong>Resend</strong> — envio de emails transacionais e de relacionamento;</li>
          <li><strong>Render e Vercel</strong> — hospedagem do backend e do site, com registros técnicos de operação.</li>
        </ul>
        <p>Também podemos compartilhar dados quando exigido por lei ou ordem de autoridade competente, para proteger direitos da TemTrend ou de terceiros, e em caso de reorganização societária (fusão, aquisição), hipótese em que as proteções desta política continuam valendo.</p>
      </section>

      <section aria-labelledby="privacidade-transferencia">
        <h2 id="privacidade-transferencia">Transferência internacional</h2>
        <p>Alguns operadores podem processar dados em servidores fora do Brasil, principalmente nos Estados Unidos. Nesses casos, a transferência observa os arts. 33 a 36 da LGPD, com garantias como cláusulas contratuais específicas e programas de conformidade dos fornecedores. Se a regulamentação da ANPD mudar, adequamos os mecanismos e atualizamos esta política.</p>
      </section>

      <section aria-labelledby="privacidade-retencao">
        <h2 id="privacidade-retencao">Retenção e eliminação</h2>
        <ul>
          <li>Dados da conta são mantidos enquanto ela existir e você usar a Plataforma.</li>
          <li>Você pode excluir a conta a qualquer momento em <strong>Conta → Excluir conta</strong>. A exclusão é imediata e irreversível: remove perfil e conteúdos salvos.</li>
          <li>Após a exclusão, podemos manter apenas o mínimo necessário para cumprir obrigações legais e fiscais, prevenir fraude e exercer direitos, pelos prazos aplicáveis (em regra, até 5 anos). Registros de acesso podem ser guardados por pelo menos 6 meses, quando aplicável o art. 15 do Marco Civil da Internet.</li>
          <li>Cópias de backup são rotacionadas e eliminadas em prazo curto; dados anonimizados podem ser mantidos para estatística.</li>
        </ul>
      </section>

      <section aria-labelledby="privacidade-seguranca">
        <h2 id="privacidade-seguranca">Segurança da informação</h2>
        <p>Adotamos medidas técnicas e administrativas compatíveis com o porte do serviço, entre elas: comunicação criptografada (HTTPS/TLS), controle de acesso por usuário e por equipe, isolamento dos dados por conta, princípio do menor privilégio, gestão de segredos e monitoramento de operação.</p>
        <p>Em caso de incidente de segurança relevante, avaliamos o risco e comunicamos você e a Autoridade Nacional de Proteção de Dados (ANPD) quando aplicável, na forma do art. 48 da LGPD, com informações sobre o ocorrido e as medidas adotadas. Nenhum sistema é totalmente imune a falhas — mantenha sua senha protegida e nunca a compartilhe.</p>
      </section>

      <section aria-labelledby="privacidade-direitos">
        <h2 id="privacidade-direitos">Seus direitos como titular</h2>
        <p>Nos termos do art. 18 da LGPD, você pode, a qualquer momento e sem custo:</p>
        <ul>
          <li>confirmar a existência de tratamento e acessar seus dados;</li>
          <li>corrigir dados incompletos, inexatos ou desatualizados;</li>
          <li>solicitar anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade com a LGPD;</li>
          <li>solicitar a portabilidade, nos termos da regulamentação;</li>
          <li>solicitar a eliminação de dados tratados com base em consentimento;</li>
          <li>saber com quem compartilhamos seus dados;</li>
          <li>revogar o consentimento e se opor a tratamentos realizados sem o amparo legal devido.</li>
        </ul>
        <p>Muitos direitos podem ser exercidos direto na conta (editar perfil, preferências, voz, excluir a conta). Para os demais, abra uma conversa no <strong>Suporte</strong> com o assunto “Privacidade”. Podemos pedir informações para confirmar sua identidade antes de atender, como medida de segurança. Respondemos em até 15 dias.</p>
        <p>Se entender que seus direitos não foram atendidos, você pode peticionar à <strong>Autoridade Nacional de Proteção de Dados (ANPD)</strong>, em gov.br/anpd.</p>
      </section>

      <section aria-labelledby="privacidade-menores">
        <h2 id="privacidade-menores">Menores de idade</h2>
        <p>A Plataforma é destinada a maiores de 18 anos. Não coletamos intencionalmente dados de crianças ou adolescentes; se identificarmos um cadastro nessa condição, ele será encerrado e os dados eliminados. Pais ou responsáveis podem falar com o Suporte para solicitar providências.</p>
      </section>

      <section aria-labelledby="privacidade-alteracoes">
        <h2 id="privacidade-alteracoes">Alterações desta política</h2>
        <p>Esta política pode ser atualizada para refletir mudanças na legislação, nos fornecedores ou no serviço. A versão vigente está sempre publicada nesta página, com data de atualização. Mudanças relevantes são comunicadas pelos canais da Plataforma com antecedência razoável. Se você continuar usando a TemTrend após a entrada em vigor, entendemos que concorda com a nova versão; se não concordar, pode encerrar a conta e cancelar a assinatura.</p>
        <p>Esta política integra o contrato com a TemTrend, junto dos <Link href="/termos">Termos de Uso</Link> e da <Link href="/reembolso">Política de Reembolso</Link>.</p>
      </section>
    </LegalPageFrame>
  );
}
