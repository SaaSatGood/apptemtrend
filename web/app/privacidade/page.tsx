import Link from "next/link";

export default function PrivacidadePage() {
  return (
    <main className="page-wrap" style={{ maxWidth: 820 }}>
      <h1>Política de Privacidade — TemTrend (MVP Beta)</h1>
      <p className="muted">Última atualização: 2026.</p>
      <p>
        Coletamos o mínimo necessário: nome, email, preferências de onboarding, produtos salvos,
        Content Kits gerados e links de publicação que você registrar.
      </p>
      <ul>
        <li>Não coletamos vídeos. Não vendemos dados.</li>
        <li>Usamos Supabase para autenticação e banco, e Gemini apenas no backend para interpretar buscas e gerar roteiros.</li>
        <li>Você pode atualizar nome e preferências em Configurações e excluir a conta a qualquer momento (LGPD, direito de eliminação).</li>
      </ul>
      <p>
        <Link href="/app">Voltar para a plataforma</Link> · <Link href="/">Início</Link>
      </p>
    </main>
  );
}
