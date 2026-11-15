"use client";

import Link from "next/link";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="tt-not-found">
      <div className="tt-not-found-shell">
        <Link className="tt-document-logo" href="/" aria-label="TemTrend, página inicial">
          <span aria-hidden="true" /><strong>TemTrend</strong>
        </Link>
        <div className="tt-not-found-content">
          <p className="tt-document-eyebrow"><span aria-hidden="true" /> Algo saiu do previsto</p>
          <strong className="tt-not-found-code" aria-hidden="true">!</strong>
          <h1>Não conseguimos carregar esta <span className="tt-hl">tela.</span></h1>
          <p>Seus dados continuam salvos. Tente novamente; se o problema persistir, fale com o suporte.</p>
          <div className="tt-not-found-actions">
            <button className="tt-document-primary" type="button" onClick={() => reset()}>Tentar novamente</button>
            <Link className="tt-document-secondary" href="/descobrir">Voltar para a plataforma</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
