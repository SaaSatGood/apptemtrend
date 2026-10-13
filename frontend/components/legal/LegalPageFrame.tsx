import type { ReactNode } from "react";
import Link from "next/link";

type Props = {
  eyebrow: string;
  title: string;
  updated: string;
  intro: string;
  children: ReactNode;
};

export default function LegalPageFrame({ eyebrow, title, updated, intro, children }: Props) {
  return (
    <div className="tt-document-page">
      <header className="tt-document-header">
        <nav className="tt-document-shell tt-document-nav" aria-label="Navegação da TemTrend">
          <Link className="tt-document-logo" href="/" aria-label="TemTrend, página inicial">
            <span aria-hidden="true">T↗</span><strong>TemTrend</strong>
          </Link>
          <Link className="tt-document-back" href="/">Voltar ao início</Link>
        </nav>
      </header>
      <main id="document-content" className="tt-document-shell tt-document-main">
        <div className="tt-document-intro">
          <p className="tt-document-eyebrow"><span aria-hidden="true" /> {eyebrow}</p>
          <h1>{title}</h1>
          <p className="tt-document-lead">{intro}</p>
          <p className="tt-document-date">Última atualização: {updated}</p>
        </div>
        <div className="tt-document-body">{children}</div>
        <nav className="tt-document-actions" aria-label="Continuar navegação">
          <Link className="tt-document-primary" href="/app">Acessar a plataforma</Link>
          <Link className="tt-document-secondary" href="/">Voltar para a landing</Link>
        </nav>
      </main>
      <footer className="tt-document-footer">
        <div className="tt-document-shell">
          <span>© 2026 TemTrend</span>
          <nav aria-label="Páginas legais">
            <Link href="/termos">Termos</Link>
            <Link href="/privacidade">Privacidade</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
