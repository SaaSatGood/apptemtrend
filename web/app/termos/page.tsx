import Link from "next/link";

export default function TermosPage() {
  return (
    <main className="page-wrap" style={{ maxWidth: 820 }}>
      <h1>Termos de Uso — TemTrend (MVP Beta)</h1>
      <p className="muted">Última atualização: 2026.</p>
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
      <p>
        <Link href="/app">Voltar para a plataforma</Link> · <Link href="/">Início</Link>
      </p>
    </main>
  );
}
