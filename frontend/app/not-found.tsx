import Link from "next/link";

export default function NotFound() {
  return (
    <main className="tt-not-found">
      <div className="tt-not-found-shell">
        <Link className="tt-document-logo" href="/" aria-label="TemTrend, página inicial">
          <span aria-hidden="true" /><strong>TemTrend</strong>
        </Link>
        <div className="tt-not-found-content">
          <p className="tt-document-eyebrow"><span aria-hidden="true" /> Página não encontrada</p>
          <strong className="tt-not-found-code" aria-hidden="true">404</strong>
          <h1>Esse caminho não existe por <span className="tt-hl">aqui.</span></h1>
          <p>Volte para a página inicial ou entre na plataforma para encontrar produtos e planejar seu próximo vídeo.</p>
          <div className="tt-not-found-actions">
            <Link className="tt-document-primary" href="/">Ir para o início</Link>
            <Link className="tt-document-secondary" href="/descobrir">Acessar a plataforma</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
