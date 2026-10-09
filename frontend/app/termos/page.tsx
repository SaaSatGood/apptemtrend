import Link from "next/link";

export default function TermosPage() {
  return (
    <main className="page-wrap" style={{ maxWidth: 820 }}>
      <h1>Termos de Uso — TemTrend (MVP Beta)</h1>
      <p className="muted">Última atualização: 8 de outubro de 2026.</p>
      <p>
        A TemTrend ajuda você a encontrar produtos do catálogo e gerar roteiros (Content Kits)
        para gravar vídeos por conta própria e publicar manualmente no TikTok Shop.
      </p>
      <ul>
        <li>A plataforma <strong>não</strong> é marketplace, não processa pagamentos de vendas e não publica vídeos automaticamente.</li>
        <li>A plataforma <strong>não</strong> armazena vídeos. A gravação acontece fora da TemTrend.</li>
        <li>Você é responsável pelo conteúdo que grava e publica, incluindo direitos de imagem, música e ofertas.</li>
        <li>Dados de tendência do catálogo são informativos e podem não ser em tempo real; a data de atualização é exibida no produto.</li>
        <li>Conta gratuita, sem cobrança. Você pode excluir sua conta em Configurações; a exclusão remove perfil e produções e é irreversível.</li>
      </ul>
      <h2>Disponibilidade e conteúdo gerado</h2>
      <p>Roteiros gerados por inteligência artificial podem conter imprecisões e devem ser revisados antes da publicação. A TemTrend pode aplicar limites de uso, suspender contas em caso de abuso e alterar recursos do beta para preservar segurança e estabilidade.</p>
      <h2>Catálogo e responsabilidade</h2>
      <p>Preços, comissões e métricas são referências do catálogo e podem mudar nas plataformas de origem. Confirme oferta, estoque, regras de afiliação e alegações sobre o produto antes de publicar.</p>
      <h2>Encerramento</h2>
      <p>Você pode deixar de usar o serviço e excluir sua conta a qualquer momento. Violações destes termos, tentativas de acesso indevido ou uso automatizado abusivo podem resultar em bloqueio.</p>
      <p>
        <Link href="/app">Voltar para a plataforma</Link> · <Link href="/">Início</Link>
      </p>
    </main>
  );
}
