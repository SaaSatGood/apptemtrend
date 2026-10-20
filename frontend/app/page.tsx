import Image from "next/image";
import ApiWarmup from "@/components/ApiWarmup";
import TrackView from "@/components/TrackView";
import LandingHero, { LandingExamples } from "./landing-hero";
import PublicNav from "@/components/PublicNav";
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
      <PublicNav page="home" />
      <div className="tt-hero-band">

        <section className="tt-hero tt-shell">
          <div className="tt-hero-copy">
            <LandingHero />
          </div>
          <div className="tt-hero-showcase">
            <Image
              className="tt-hero-creators-image"
              src="/product-still-life.png"
              alt="Garrafa térmica rosa com outros produtos em uma composição de estúdio"
              width={1536}
              height={1024}
              sizes="(max-width: 900px) 100vw, 50vw"
              priority
              loading="eager"
            />
            <div className="tt-hero-product-preview">
              <span>Exemplo ilustrativo</span>
              <strong>Garrafa térmica</strong>
              <p>Ideia de vídeo: teste a temperatura da bebida durante a rotina.</p>
            </div>
          </div>
        </section>

        <div className="tt-shell tt-hero-plan-preview" aria-label="Exemplo de plano de gravação">
          <div><span>Depois da escolha</span><strong>Seu plano já aponta o que gravar.</strong></div>
          <ol>
            <li><b>01</b><span>Abra com uma pergunta sobre a bebida.</span></li>
            <li><b>02</b><span>Mostre a garrafa em uso.</span></li>
            <li><b>03</b><span>Feche com o resultado do teste.</span></li>
          </ol>
          <a href="#content-kits">Veja o plano completo <span aria-hidden="true">↗</span></a>
        </div>

      </div>

      <div className="tt-shell tt-landing-examples"><LandingExamples /></div>

      <section className="tt-journey" aria-labelledby="journey-title">
        <div className="tt-shell tt-journey-shell">
          <div className="tt-journey-heading">
            <h2 id="journey-title">Do produto à publicação.</h2>
            <p>Encontre uma oportunidade, transforme a ideia em plano e grave no seu ritmo.</p>
          </div>
          <ol className="tt-journey-flow" aria-label="Etapas da criação de conteúdo">
            <li>Produto</li>
            <li>Ideia</li>
            <li>Plano</li>
            <li>Vídeo</li>
            <li>Publicação</li>
          </ol>
          <div className="tt-journey-proof" aria-label="O que a TemTrend entrega">
            <article className="tt-journey-proof-main">
              <strong>Um plano em 8 partes.</strong>
              <p>Abertura, cenas, roteiro, legenda, chamada final, hashtags, áudio e duração. Tudo organizado para você gravar.</p>
            </article>
            <div className="tt-journey-proof-side">
              <article><strong>Produtos reais</strong><p>Catálogo com preço, vendas e comissão estimada de itens do TikTok Shop.</p></article>
              <article><strong>7 dias de Pro por nossa conta</strong><p>Crie sua conta e gere seu primeiro plano de gravação em minutos, sem cartão.</p></article>
            </div>
          </div>
        </div>
      </section>

        <LandingRebuild />
      </main>

      <LandingFooter />
    </div>
  );
}
