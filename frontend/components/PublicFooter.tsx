import Link from "next/link";
import Icon from "@/components/ui/Icon";

// Rodapé único das páginas públicas. Os links de seção usam "/#..." para
// funcionar tanto na landing quanto em /planos e nas páginas legais.
export default function PublicFooter() {
  return (
    <footer className="tt-lp-footer">
      <div className="tt-lp-wrap">
        <div className="tt-lp-footer-top">
          <div>
            <Link className="tt-lp-footer-brand" href="/" aria-label="TemTrend, voltar ao início">
              <span aria-hidden="true" />
              <strong>TemTrend</strong>
            </Link>
            <p>
              Produto vira conteúdo.
              <br />
              Conteúdo vira oportunidade.
            </p>
            <Link className="tt-lp-btn tt-lp-btn-lime" href="/app?mode=signup">
              Criar conta grátis
              <Icon name="arrow-right" size={18} />
            </Link>
          </div>
          <nav className="tt-lp-footer-cols" aria-label="Links do rodapé">
            <div>
              <strong>Produto</strong>
              <Link href="/#como-funciona">Como funciona</Link>
              <Link href="/#plano">Plano de gravação</Link>
              <Link href="/#planos">Planos</Link>
              <Link href="/#faq">Dúvidas</Link>
            </div>
            <div>
              <strong>Conta</strong>
              <Link href="/app">Entrar</Link>
              <Link href="/app?mode=signup">Criar conta</Link>
              <Link href="/app/suporte">Suporte</Link>
            </div>
            <div>
              <strong>Legal</strong>
              <Link href="/termos">Termos de uso</Link>
              <Link href="/privacidade">Privacidade</Link>
              <Link href="/reembolso">Reembolso</Link>
            </div>
          </nav>
        </div>
        <div className="tt-lp-footer-bottom">
          <span>© 2026 TemTrend</span>
          <span>TemTrend não é afiliada, patrocinada nem endossada pelo TikTok ou TikTok Shop.</span>
          <Link href="/app/suporte">Contato: suporte na plataforma</Link>
        </div>
      </div>
    </footer>
  );
}
