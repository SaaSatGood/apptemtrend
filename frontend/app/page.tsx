import Image from "next/image";
import Link from "next/link";
import ApiWarmup from "@/components/ApiWarmup";
import TrackView from "@/components/TrackView";
import PublicFooter from "@/components/PublicFooter";
import PublicNav from "@/components/PublicNav";
import Icon from "@/components/ui/Icon";
import { faqs } from "@/lib/landing-data";
import LandingHero from "./landing-hero";
import LandingDemo from "./landing-demo";
import LandingPlans from "./landing-plans";
import LandingReveal from "./landing-reveal";

const steps = [
  {
    title: "Escolha o produto",
    text: "Compare oportunidades do catálogo do TikTok Shop e encontre um ponto de partida.",
    icon: "/hero-icon-product.png",
    iconWidth: 1536,
    iconHeight: 1024,
  },
  {
    title: "Receba o plano",
    text: "Abra abertura, cenas, roteiro e chamada final organizados para adaptar.",
    icon: "/hero-icon-plan.png",
    iconWidth: 1536,
    iconHeight: 1024,
  },
  {
    title: "Grave e acompanhe",
    text: "Use seu celular, grave no seu ritmo e marque o vídeo como publicado.",
    icon: "/hero-icon-video.png",
    iconWidth: 1402,
    iconHeight: 1122,
  },
];

const landingFaqs = [faqs[0], faqs[1], faqs[3], faqs[4], faqs[5]];

export default function LandingPage() {
  return (
    <div className="tt-home tt-lp">
      <ApiWarmup />
      <TrackView event="landing_view" />
      <LandingReveal />
      <a className="tt-skip-link" href="#landing-discover-input">Pular para busca de produtos</a>
      <PublicNav page="home" />

      <main id="top">
        <section className="tt-lp-hero" aria-labelledby="hero-title">
          <div className="tt-lp-hero-glow" aria-hidden="true" />
          <div className="tt-lp-wrap tt-lp-hero-inner">
            <div className="tt-lp-hero-copy">
              <span className="tt-lp-badge"><i aria-hidden="true" /> Feito para creators do TikTok Shop</span>
              <h1 id="hero-title" className="tt-lp-h1">
                Do produto ao vídeo,
                <span className="tt-lp-hl">sem começar do zero.</span>
              </h1>
              <p className="tt-lp-hero-sub">
                Encontre produtos para vender no TikTok Shop, receba um plano de gravação
                em 8 partes e grave com clareza.
              </p>
              <LandingHero />
            </div>

            <div className="tt-lp-hero-visual" aria-hidden="true">
              <div className="tt-lp-app">
                <div className="tt-lp-app-top">
                  <span className="tt-lp-app-brand"><i /> TemTrend</span>
                  <span className="tt-lp-app-tab is-active">Descobrir</span>
                  <span className="tt-lp-app-tab">Produção</span>
                  <span className="tt-lp-app-tab">Planos</span>
                  <span className="tt-lp-app-avatar">R</span>
                </div>
                <div className="tt-lp-app-body">
                  <aside className="tt-lp-app-side">
                    <span className="is-active">Oportunidades</span>
                    <span>Meus produtos</span>
                    <span>Minha produção</span>
                    <span>Planos</span>
                    <div className="tt-lp-side-note"><b>Grátis</b><small>3 buscas + 3 roteiros</small></div>
                  </aside>
                  <div className="tt-lp-app-main">
                    <div className="tt-lp-app-search">
                      <Icon name="search" size={13} />
                      <span>garrafa térmica para demonstrar</span>
                      <kbd>↵</kbd>
                    </div>
                    <div className="tt-lp-app-grid">
                      <article className="tt-lp-product">
                        <span className="tt-lp-product-tag">Oportunidade</span>
                        <Image
                          className="tt-lp-product-thumb"
                          src="/hero-tumbler-v2.png"
                          alt=""
                          width={640}
                          height={420}
                          sizes="(max-width: 760px) 40vw, 220px"
                          priority
                        />
                        <div className="tt-lp-product-info">
                          <span>Casa · acessórios</span>
                          <strong>Garrafa térmica 1,2 L</strong>
                          <div><b>R$ 49,90</b><small>12% de comissão</small></div>
                        </div>
                      </article>
                      <div className="tt-lp-hero-plan">
                        <div className="tt-lp-hero-plan-head"><span>Plano de gravação</span><b>8 partes</b></div>
                        <ol className="tt-lp-hero-steps">
                          <li><b>01</b><div><strong>Abertura</strong><span>“Sua bebida ainda está gelada?”</span></div></li>
                          <li><b>02</b><div><strong>Demonstração</strong><span>Mostre o gelo e a tampa.</span></div></li>
                          <li><b>03</b><div><strong>Chamada final</strong><span>“O link está no vídeo.”</span></div></li>
                        </ol>
                        <div className="tt-lp-hero-plan-foot"><span>Roteiro</span><span>Legenda</span><span>Hashtags</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <span className="tt-lp-float is-a">
                <Icon name="check" size={14} />
                Oportunidade encontrada
              </span>
              <span className="tt-lp-float is-b">
                <Icon name="check" size={14} /> Plano pronto para gravar
              </span>
            </div>
          </div>
        </section>

        <section className="tt-lp-steps" id="como-funciona" aria-labelledby="steps-title">
          <div className="tt-lp-steps-art">
            <Image
              className="tt-lp-steps-hand tt-lp-steps-hand-left"
              src="/renaissance-reaching-hand.png"
              alt=""
              aria-hidden="true"
              width={1816}
              height={866}
              sizes="(max-width: 760px) 300px, (max-width: 1100px) 420px, 560px"
            />
            <div className="tt-lp-steps-intro" data-reveal>
              <h2 id="steps-title">Três passos para gravar.</h2>
              <p>Escolha o produto, receba um roteiro e grave do seu jeito.</p>
            </div>
            <Image
              className="tt-lp-steps-hand tt-lp-steps-hand-right"
              src="/renaissance-phone-hand.png"
              alt=""
              aria-hidden="true"
              width={1828}
              height={860}
              sizes="(max-width: 760px) 340px, (max-width: 1100px) 450px, 590px"
            />
          </div>
          <div className="tt-lp-wrap">
            <ol className="tt-lp-step-grid">
              {steps.map((step, index) => (
                <li className="tt-lp-step" key={step.title} data-reveal>
                  <div className="tt-lp-step-top">
                    <span className="tt-lp-step-num">{String(index + 1).padStart(2, "0")}</span>
                    <Image
                      className="tt-lp-step-icon"
                      src={step.icon}
                      alt=""
                      width={step.iconWidth}
                      height={step.iconHeight}
                      sizes="112px"
                    />
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                  <span className="tt-lp-step-arrow" aria-hidden="true"><Icon name="arrow-right" size={22} /></span>
                </li>
              ))}
            </ol>
            <div className="tt-lp-steps-cta" data-reveal>
              <Link className="tt-lp-btn tt-lp-btn-dark" href="/app?mode=signup">
                Começar agora
                <Icon name="arrow-right" size={18} />
              </Link>
              <span>3 pesquisas e 3 roteiros por conta · sem cartão</span>
            </div>
          </div>
        </section>

        <LandingDemo />
        <LandingPlans />

        <section className="tt-lp-faq" id="faq" aria-labelledby="faq-title">
          <div className="tt-lp-wrap tt-lp-faq-grid">
            <div className="tt-lp-faq-copy" data-reveal>
              <span className="tt-lp-kicker">Dúvidas</span>
              <h2 id="faq-title">Antes de <em>apertar REC.</em></h2>
              <p>
                Sem promessa de venda garantida: a TemTrend ajuda você a decidir,
                planejar e acompanhar o que produz.
              </p>
              <Link className="tt-lp-btn tt-lp-btn-outline" href="/app/suporte">
                Falar com suporte
                <Icon name="arrow-right" size={18} />
              </Link>
            </div>
            <div className="tt-lp-faq-list" data-reveal>
              {landingFaqs.map(([question, answer], index) => (
                <details key={question}>
                  <summary>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{question}</strong>
                    <i aria-hidden="true">+</i>
                  </summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="tt-lp-cta" aria-labelledby="cta-title">
          <div className="tt-lp-wrap">
            <div className="tt-lp-cta-inner" data-reveal>
              <div className="tt-lp-cta-copy">
                <span className="tt-lp-kicker">O próximo passo é seu</span>
                <h2 id="cta-title">Seu próximo vídeo <em>começa aqui.</em></h2>
                <p>Encontre um produto, receba o plano e grave do seu jeito.</p>
                <div className="tt-lp-cta-actions">
                  <Link className="tt-lp-btn tt-lp-btn-dark" href="/app?mode=signup">
                    Começar agora
                    <Icon name="arrow-right" size={18} />
                  </Link>
                  <Link className="tt-lp-btn tt-lp-btn-ghost" href="/planos">Ver planos</Link>
                </div>
              </div>
              <div className="tt-lp-cta-art" aria-hidden="true">
                <Image
                  className="tt-lp-cta-rocket"
                  src="/landing-rocket-launch.png"
                  alt=""
                  width={1024}
                  height={1536}
                  sizes="(max-width: 760px) 190px, (max-width: 900px) 240px, 300px"
                />
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
