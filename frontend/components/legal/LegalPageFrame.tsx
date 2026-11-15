import type { ReactNode } from "react";
import Link from "next/link";
import PublicFooter from "@/components/PublicFooter";
import PublicNav from "@/components/PublicNav";
import HighlightedTitle from "@/components/platform/HighlightedTitle";

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
      <PublicNav page="legal" />
      <main id="document-content" className="tt-document-shell tt-document-main">
        <div className="tt-document-intro">
          <p className="tt-document-eyebrow"><span aria-hidden="true" /> {eyebrow}</p>
          <h1><HighlightedTitle text={title} /></h1>
          <p className="tt-document-lead">{intro}</p>
          <p className="tt-document-date">Última atualização: {updated}</p>
        </div>
        <div className="tt-document-body">{children}</div>
        <nav className="tt-document-actions" aria-label="Continuar navegação">
          <Link className="tt-document-primary" href="/descobrir">Acessar a plataforma</Link>
          <Link className="tt-document-secondary" href="/">Voltar para a landing</Link>
        </nav>
      </main>
      <PublicFooter />
    </div>
  );
}
