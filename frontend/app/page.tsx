import Image from "next/image";
import Link from "next/link";
import ApiWarmup from "@/components/ApiWarmup";
import TrackView from "@/components/TrackView";
import PublicFooter from "@/components/PublicFooter";
import PublicNav from "@/components/PublicNav";
import Icon from "@/components/ui/Icon";
import { faqs } from "@/lib/landing-data";
import { pageMetadata, SITE_NAME, SITE_URL } from "@/lib/seo";
import LandingHero from "./landing-hero";
import LandingDemo from "./landing-demo";
import LandingFaq from "./landing-faq";
import LandingPartners from "./landing-partners";
import LandingPlans from "./landing-plans";
import LandingReveal from "./landing-reveal";
import LandingTestimonials from "./landing-testimonials";

const steps = [
  {
    title: "Encontre seu produto",
    text: "Explore produtos reais do TikTok Shop e descubra oportunidades para criar conteúdo.",
    icon: "/hero-icon-product.png",
    iconWidth: 1536,
    iconHeight: 1024,
  },
  {
    title: "Receba seu roteiro",
    text: "Receba ideias, ganchos, cenas, legendas e chamadas para ação prontas para gravar.",
    icon: "/hero-icon-plan.png",
    iconWidth: 1536,
    iconHeight: 1024,
  },
  {
    title: "Grave e publique",
    text: "Grave do seu jeito, leia o roteiro na tela e acompanhe sua produção.",
    icon: "/hero-icon-video.png",
    iconWidth: 1402,
    iconHeight: 1122,
  },
];

export const metadata = pageMetadata({
  title: "TemTrend — Produtos e roteiros para o TikTok Shop",
  description:
    "Encontre produtos para vender no TikTok Shop e receba um plano de gravação em 8 partes: abertura, cenas, roteiro, legenda, CTA e hashtags.",
  path: "/",
  absoluteTitle: true,
});

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/icon.png`,
      description:
        "Plataforma de descoberta de produtos e criação de planos de gravação para creators do TikTok Shop.",
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
      inLanguage: "pt-BR",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "SoftwareApplication",
      name: SITE_NAME,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: SITE_URL,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "BRL",
        description: "Plano Grátis com 100 buscas e 10 roteiros por semana.",
      },
    },
    {
      "@type": "FAQPage",
      mainEntity: faqs.map(([question, answer]) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    },
  ],
};

export default function LandingPage() {
  return (
    <div className="tt-home tt-lp">
      <ApiWarmup />
      <TrackView event="landing_view" />
      <LandingReveal />
      <a className="tt-skip-link" href="#top">Pular para o conteúdo</a>
      <PublicNav page="home" />

      <main id="top">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <LandingHero />

        <section className="tt-lp-steps" id="como-funciona" aria-labelledby="steps-title">
          <div className="tt-lp-steps-art">
            <div className="tt-lp-steps-intro" data-reveal>
              <span className="tt-lp-steps-eyebrow">Como funciona</span>
              <h2 id="steps-title">
                Da ideia ao vídeo em{" "}
                <span className="tt-hr-highlight">três passos.</span>
              </h2>
              <p>
                Tudo o que você precisa para encontrar produtos, planejar conteúdos
                e começar a vender no TikTok Shop.
              </p>
            </div>
            <div className="tt-lp-wrap tt-lp-steps-content">
              <ol className="tt-lp-step-grid">
                {steps.map((step, index) => (
                  <li className="tt-lp-step" key={step.title} data-reveal>
                    <div className="tt-lp-step-top">
                      <span className="tt-lp-step-num">
                        <span className="tt-lp-step-num-label">Passo</span>
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="tt-lp-step-icon-wrap" aria-hidden="true">
                        <Image
                          className="tt-lp-step-icon"
                          src={step.icon}
                          alt=""
                          width={step.iconWidth}
                          height={step.iconHeight}
                          sizes="(max-width: 760px) 142px, (max-width: 1024px) 148px, 192px"
                        />
                      </span>
                    </div>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                    <div className="tt-lp-step-foot">
                      <span className="tt-lp-step-progress" aria-hidden="true">
                        {steps.map((_, marker) => (
                          <i key={marker} className={marker <= index ? "is-on" : undefined} />
                        ))}
                      </span>
                      <span className="tt-lp-step-arrow" aria-hidden="true">
                        <Icon name="arrow-right" size={20} />
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="tt-lp-steps-cta" data-reveal>
                <div className="tt-lp-steps-cta-copy">
                  <h3>Pronto para começar?</h3>
                </div>
                <Link className="tt-lp-btn tt-lp-btn-lime" href="/descobrir?mode=signup">
                  Começar grátis
                  <Icon name="arrow-right" size={18} />
                </Link>
              </div>
            </div>
          </div>
        </section>

        <LandingDemo />
        <LandingPlans />
        <LandingTestimonials />

        <LandingFaq />

        <LandingPartners />
      </main>

      <PublicFooter />
    </div>
  );
}
