import Link from "next/link";

export default function PrivacidadePage() {
  return (
    <main className="page-wrap" style={{ maxWidth: 820 }}>
      <h1>Política de Privacidade — TemTrend (MVP Beta)</h1>
      <p className="muted">Última atualização: 8 de outubro de 2026.</p>
      <p>
        Coletamos o mínimo necessário: nome, email, preferências de onboarding, produtos salvos,
        Content Kits gerados e links de publicação que você registrar.
      </p>
      <ul>
        <li>Não coletamos vídeos. Não vendemos dados.</li>
        <li>Usamos Supabase para autenticação e banco, e Gemini apenas no backend para interpretar buscas e gerar roteiros.</li>
        <li>Você pode atualizar nome e preferências em Configurações e excluir a conta a qualquer momento (LGPD, direito de eliminação).</li>
      </ul>
      <h2>Finalidades e bases de tratamento</h2>
      <p>Os dados são usados para autenticar sua conta, personalizar a descoberta de produtos, gerar seus planos de gravação, organizar sua produção, prevenir abuso e manter a segurança do serviço. O tratamento ocorre para executar o serviço solicitado, cumprir obrigações legais e proteger o funcionamento da plataforma.</p>
      <h2>Compartilhamento e operadores</h2>
      <p>Supabase processa autenticação, banco e imagens; o Gemini recebe somente o contexto necessário para interpretar a busca e montar o roteiro. Não enviamos sua senha nem armazenamos vídeos.</p>
      <h2>Retenção e segurança</h2>
      <p>Dados da conta permanecem enquanto ela estiver ativa e podem ser mantidos pelo prazo necessário para segurança, prevenção a fraude ou obrigação legal. Aplicamos controles de acesso, isolamento por usuário e comunicação criptografada.</p>
      <h2>Seus direitos</h2>
      <p>Você pode acessar e corrigir seus dados pela área da conta e solicitar eliminação excluindo a conta. Também pode pedir informações sobre tratamento, portabilidade, oposição ou revisão conforme a LGPD pelo canal de atendimento informado oficialmente pela TemTrend.</p>
      <p>
        <Link href="/app">Voltar para a plataforma</Link> · <Link href="/">Início</Link>
      </p>
    </main>
  );
}
