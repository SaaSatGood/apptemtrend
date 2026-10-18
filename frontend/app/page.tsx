import Image from "next/image";
import Link from "next/link";
import ApiWarmup from "@/components/ApiWarmup";
import TrackView from "@/components/TrackView";
import LandingHero from "./landing-hero";
import LandingMenu from "./landing-menu";
import LandingMotion from "./landing-motion";
import LandingRebuild, { LandingFooter } from "./landing-rebuild";

export default function LandingPage() {
  return (
    <div className="tt-home">
      <ApiWarmup />
      <TrackView event="landing_view" />
      <LandingMotion />
      <a className="tt-skip-link" href="#landing-discover-input">Pular para busca de produtos</a>
      <main id="top">
      <header className="tt-header">
        <nav className="tt-shell tt-nav" aria-label="Navegação principal">
          <Link className="tt-logo" href="#top" aria-label="TemTrend, início">
            <span aria-hidden="true">T</span><b>TemTrend</b>
          </Link>
          <div className="tt-nav-links" id="nav-links">
            <span className="tt-menu-kicker">Explorar a TemTrend</span>
            <a href="#como-funciona" aria-label="Como funciona">Como funciona</a><a href="#content-kits" aria-label="Plano de gravação">Plano de gravação</a><a href="#produtos" aria-label="Produtos">Produtos</a><Link href="/planos" aria-label="Planos e preços">Planos</Link><a href="#faq" aria-label="FAQ">FAQ</a>
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
              sizes="(max-width: 900px) 100vw, 50vw"
              priority
            />
            <span className="tt-hero-spark" aria-hidden="true" />
          </div>
        </section>

        <section className="tt-trust"><div className="tt-shell"><p>Pare de enrolar. O caminho é esse.</p><div className="tt-trust-flow" aria-label="Fluxo da TemTrend"><span>Produto</span><i>→</i><span>Ideia</span><i>→</i><span>Plano</span><i>→</i><span>Vídeo</span><i>→</i><span>Publicação</span></div></div></section>
      </div>

      <section className="tt-facts" aria-label="O que a TemTrend entrega">
        <div className="tt-shell">
          <div className="tt-facts-grid">
            <article><strong>Produtos reais, não mock</strong><p>Catálogo com preço, vendas e comissão estimada de itens do TikTok Shop.</p></article>
            <article><strong>Plano completo em 8 partes</strong><p>Abertura, cenas, roteiro, legenda, chamada final, hashtags, áudio e duração.</p></article>
            <article><strong>7 dias de Pro por nossa conta</strong><p>Crie sua conta e gere seu primeiro plano de gravação em minutos — sem cartão.</p></article>
          </div>
        </div>
      </section>

        <LandingRebuild />
      </main>

      <LandingFooter />
    </div>
  );
}
