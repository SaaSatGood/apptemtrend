import Link from "next/link";

export default function NotFound() {
  return (
    <main className="tt-not-found">
      <div className="tt-not-found-shell">
        <Link className="tt-document-logo" href="/" aria-label="TemTrend, página inicial">
          <span aria-hidden="true">T↗</span><strong>TemTrend</strong>
        </Link>
        <div className="tt-not-found-content">
          <p className="tt-document-eyebrow"><span aria-hidden="true" /> Página não encontrada</p>
          <strong className="tt-not-found-code" aria-hidden="true">404</strong>
          <h1>Esse caminho não existe <em>por aqui.</em></h1>
          <p>Volte para a página inicial ou entre na plataforma para encontrar produtos e planejar seu próximo vídeo.</p>
          <div className="tt-not-found-actions">
            <Link className="tt-document-primary" href="/">Ir para o início <span aria-hidden="true">↗</span></Link>
            <Link className="tt-document-secondary" href="/app">Acessar a plataforma</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
