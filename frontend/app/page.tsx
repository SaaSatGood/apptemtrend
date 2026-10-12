import Image from "next/image";
import Link from "next/link";
import LandingHero from "./landing-hero";
import LandingMenu from "./landing-menu";
import LandingMotion from "./landing-motion";
import LandingRebuild, { LandingFooter } from "./landing-rebuild";

export default function LandingPage() {
  return (
    <div className="tt-home">
      <LandingMotion />
      <a className="tt-skip-link" href="#landing-discover-input">Pular para busca de produtos</a>
      <main id="top">
      <header className="tt-header">
        <nav className="tt-shell tt-nav" aria-label="Navegação principal">
          <Link className="tt-logo" href="#top" aria-label="TemTrend, início">
            <span aria-hidden="true">T</span><b>TemTrend</b>
          </Link>
          <div className="tt-nav-links" id="nav-links">
            <a href="#como-funciona">Como funciona</a><a href="#content-kits">Plano de gravação</a><a href="#produtos">Produtos</a><a href="#faq">FAQ</a>
            <Link className="tt-mobile-login" href="/app">Entrar</Link>
          </div>
          <div className="tt-nav-actions">
            <Link className="tt-login" href="/app">Entrar</Link>
            <Link className="tt-btn tt-btn-small" href="/app?mode=signup">Começar agora</Link>
            <LandingMenu />
          </div>
        </nav>
      </header>
      <div className="tt-hero-band">

        <section className="tt-hero tt-shell">
          <div className="tt-hero-copy">
            <LandingHero />
          </div>
          <div className="tt-hero-showcase">
            <Image
              className="tt-hero-creators-image"
              src="/hero-creators-reference.png"
              alt="Três criadores mostrando uma garrafa rosa, um gadget e um aparelho facial"
              width={1536}
              height={1024}
              priority
            />
            <span className="tt-hero-spark" aria-hidden="true" />
            <span className="tt-hero-play tt-hero-play-middle" aria-hidden="true">▷</span>
            <span className="tt-hero-play tt-hero-play-last" aria-hidden="true">▷</span>
          </div>
        </section>

        <section className="tt-trust"><div className="tt-shell"><p>Pare de enrolar. O caminho é esse.</p><div className="tt-trust-flow" aria-label="Fluxo da TemTrend"><span>Produto</span><i>→</i><span>Ideia</span><i>→</i><span>Plano</span><i>→</i><span>Vídeo</span><i>→</i><span>Venda</span></div></div></section>
      </div>

        <LandingRebuild />
      </main>

      <LandingFooter />
    </div>
  );
}
