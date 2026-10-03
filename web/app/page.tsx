import Link from "next/link";
import Image from "next/image";
import {
  benefits,
  faqs,
  peoplePhotos,
  problems,
  products,
  profiles,
  transformation,
  workflow,
} from "../lib/landing-data";
import LandingMenu from "./landing-menu";

export default function LandingPage() {
  return (
    <>
      <header className="site-header">
        <nav className="nav shell" aria-label="Navegação principal">
          <Link className="logo" href="#top" aria-label="TemTrend, início">
            <span>T</span>TEMTREND
          </Link>
          <div className="nav-links" id="nav-links">
            <a href="#como-funciona">Como funciona</a>
            <a href="#produtos">Produtos</a>
            <a href="#content-kits">Content Kits</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className="nav-actions">
            <Link className="text-link" href="/app">
              Entrar
            </Link>
            <Link className="button button-small" href="/app?mode=signup">
              Começar a vender
            </Link>
            <LandingMenu />
          </div>
        </nav>
      </header>
      <main id="top">
        <section className="hero shell section">
          <div className="hero-copy">
            <span className="kicker">TIKTOK SHOP • COMECE A VENDER</span>
            <h1>
              GANHE DINHEIRO
              <br />
              VENDENDO NO
              <br />
              <span>TIKTOK SHOP.</span>
            </h1>
            <p>
              Encontre produtos para vender. Descubra o que gravar. Publique no TikTok e
              transforme conteúdo em vendas.
            </p>
            <div className="hero-actions">
              <Link className="button" href="/app?mode=signup">
                QUERO COMEÇAR A VENDER →
              </Link>
              <a className="button button-light" href="#como-funciona">
                COMO FUNCIONA
              </a>
            </div>
            <small>Você não precisa ser influencer.</small>
          </div>
          <div
            className="hero-showcase"
            aria-label="Pessoas criando vídeos para apresentar produtos no TikTok"
          >
            {peoplePhotos.map((photo, index) => (
              <div key={photo.src} className={`float-product float-${["one", "two", "three"][index]}`}>
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  width={400}
                  height={500}
                  priority={index === 0}
                />
              </div>
            ))}
          </div>
        </section>

        <section className="problem section" id="como-funciona">
          <div className="shell">
            <span className="kicker">ANTES DE VENDER</span>
            <h2>
              VOCÊ QUER VENDER.
              <br />
              MAS NÃO SABE POR ONDE COMEÇAR.
            </h2>
            <div className="question-grid">
              {problems.map((text, index) => (
                <article key={text} className="question-card progress-card">
                  <span>0{index + 1}</span>
                  <h3>{text}</h3>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="transformation section">
          <div className="shell">
            <span className="kicker">UM PROCESSO CLARO</span>
            <h2>DA IDEIA À VENDA.</h2>
            <div className="flow">
              {transformation.map((text, index) => (
                <span key={text}>
                  <div className="flow-step">
                    <span>0{index + 1}</span>
                    <strong>{text}</strong>
                  </div>
                  {index < transformation.length - 1 && <i>→</i>}
                </span>
              ))}
            </div>
            <p className="section-note">Encontre. Grave. Publique. Venda.</p>
          </div>
        </section>

        <section className="creator-section section">
          <div className="shell split">
            <div>
              <span className="kicker">COMECE DO SEU JEITO</span>
              <h2>
                VOCÊ NÃO<br />
                PRECISA SER
                <br />
                INFLUENCER.
              </h2>
              <p className="lead">
                Você só precisa começar. Não precisa de milhares de seguidores para criar.
              </p>
            </div>
            <div className="profile-stack">
              {profiles.map(([number, title, body]) => (
                <article key={number}>
                  <span>{number}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="kit-section section" id="content-kits">
          <div className="shell">
            <div className="section-heading">
              <span className="kicker">NÃO É SÓ UMA IDEIA</span>
              <h2>UM PLANO PRONTO PARA GRAVAR.</h2>
              <p>Você recebe a ideia, o roteiro e as cenas do vídeo.</p>
            </div>
            <div className="kit-mockup">
              <div className="kit-sidebar">
                <span className="kit-badge">CONTENT KIT</span>
                <div className="kit-product">
                  <div className="product-art coral">◎</div>
                  <div>
                    <small>PRODUTO</small>
                    <strong>Massageador facial</strong>
                  </div>
                </div>
                <nav>
                  <a className="active">Conceito</a>
                  <a>Hook</a>
                  <a>Cenas</a>
                  <a>Roteiro</a>
                  <a>Copy e CTA</a>
                </nav>
              </div>
              <div className="kit-content">
                <section>
                  <small>CONCEITO</small>
                  <h3>Transforme uma característica simples do produto em um vídeo que desperta curiosidade.</h3>
                </section>
                <section className="hook-card">
                  <small>HOOK</small>
                  <strong>“Você precisa ver isso antes de comprar...”</strong>
                </section>
                <section>
                  <small>CENAS</small>
                  <div className="kit-scenes">
                    <span><b>01</b> Hook</span>
                    <span><b>02</b> Demonstração</span>
                    <span><b>03</b> Benefício</span>
                    <span><b>04</b> CTA</span>
                  </div>
                </section>
                <div className="kit-grid">
                  <section>
                    <small>ROTEIRO</small>
                    <p>Comece mostrando o problema. Aproxime o produto e demonstre como ele funciona em poucos segundos.</p>
                  </section>
                  <section>
                    <small>COPY</small>
                    <p>Uma descoberta simples para transformar sua rotina.</p>
                  </section>
                  <section>
                    <small>CTA</small>
                    <p>Confira o produto no TikTok Shop.</p>
                  </section>
                </div>
                <div className="kit-footer">
                  <div>
                    <small>HASHTAGS</small>
                    <p>#tiktokshop &nbsp; #achadinhos &nbsp; #produtos</p>
                  </div>
                  <div>
                    <small>ÁUDIO E DURAÇÃO</small>
                    <p>Som em alta · 27 segundos</p>
                  </div>
                  <Link className="button button-small" href="/app?mode=signup">
                    Ver Content Kit →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="before-after section">
          <div className="shell">
            <span className="kicker">ANTES / DEPOIS</span>
            <h2>CHEGA DE COMEÇAR DO ZERO.</h2>
            <div className="comparison">
              <article>
                <small>ANTES</small>
                <h3>Tenho um produto.</h3>
                <p className="before-question">O que eu faço com isso?</p>
                <strong className="question-mark">?</strong>
              </article>
              <article className="after">
                <small>DEPOIS</small>
                <h3>Tenho um produto.</h3>
                <p>Já sei o que gravar.</p>
                <div className="mini-flow">
                  <b>Produto</b>
                  <span>↓</span>
                  <b>Hook</b>
                  <span>↓</span>
                  <b>Roteiro</b>
                  <span>↓</span>
                  <b>Cenas</b>
                  <span>↓</span>
                  <b>CTA</b>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="products-section section" id="produtos">
          <div className="shell">
            <div className="section-heading">
              <span className="kicker">DESCUBRA O QUE VENDER</span>
              <h2>ENCONTRE O PRÓXIMO PRODUTO QUE VOCÊ VAI VENDER.</h2>
              <p>Escolha um produto e veja como criar um vídeo para ele.</p>
            </div>
            <div className="product-grid">
              {products.map(({ category, name, image }) => (
                <article key={name} className="landing-product">
                  <Image
                    className="product-visual"
                    src={image}
                    alt={name}
                    width={700}
                    height={500}
                    loading="lazy"
                  />
                  <small>{category}</small>
                  <h3>{name}</h3>
                  <Link className="product-status" href="/app?mode=signup">
                    Ver Content Kit →
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="workflow section">
          <div className="shell">
            <span className="kicker">SEM ADIVINHAÇÃO</span>
            <h2>É SIMPLES.</h2>
            <div className="timeline">
              {workflow.map(([number, title, body]) => (
                <article key={number}>
                  <span>{number}</span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="social-proof section">
          <div className="shell">
            <span className="kicker">FEITO PARA QUEM QUER COMEÇAR</span>
            <h2>
              COMECE DO
              <br />
              SEU JEITO.
            </h2>
            <div className="audience-grid">
              {profiles.map(([, title, body], index) => (
                <article key={title} className="audience-card">
                  {peoplePhotos[index] && (
                    <Image
                      src={peoplePhotos[index].src}
                      alt={`${title} criando um vídeo; imagem editorial ilustrativa`}
                      width={400}
                      height={310}
                      loading="lazy"
                    />
                  )}
                  <div>
                    <small>PARA COMEÇAR</small>
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="benefits section">
          <div className="shell">
            <div className="section-heading">
              <span className="kicker">TUDO NO MESMO FLUXO</span>
              <h2>VOCÊ NÃO PRECISA DE MAIS UMA FERRAMENTA.</h2>
              <p>Você precisa saber o que fazer a seguir.</p>
            </div>
            <div className="benefit-grid">
              {benefits.map(([icon, title]) => (
                <article key={title}>
                  <i>{icon}</i>
                  <h3>{title}</h3>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="dark-cta section">
          <div className="shell">
            <div className="glow cyan-glow"></div>
            <div className="glow pink-glow"></div>
            <h2>
              PARAR DE ASSISTIR.
              <br />
              COMEÇAR A VENDER.
            </h2>
            <p>Encontre um produto. Descubra o que gravar. Publique.</p>
            <Link className="button button-white" href="/app?mode=signup">
              QUERO COMEÇAR A VENDER →
            </Link>
          </div>
        </section>

        <section className="faq section" id="faq">
          <div className="shell narrow">
            <div className="section-heading">
              <span className="kicker">PERGUNTAS FREQUENTES</span>
              <h2>O QUE VOCÊ PRECISA SABER.</h2>
            </div>
            <div>
              {faqs.map(([question, answer]) => (
                <details key={question}>
                  <summary>
                    {question}
                    <span>+</span>
                  </summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="final-cta section">
          <div className="shell">
            <h2>
              SEU PRÓXIMO VÍDEO
              <br />
              PODE COMEÇAR
              <br />
              COM UM PRODUTO.
            </h2>
            <p>Escolha um produto. Descubra o que gravar.</p>
            <Link className="button" href="/app?mode=signup">
              COMEÇAR A VENDER →
            </Link>
          </div>
        </section>
      </main>
      <footer>
        <div className="shell footer-grid">
          <div>
            <a className="logo footer-logo" href="#top">
              <span>T</span>TEMTREND
            </a>
            <p>
              Produto vira conteúdo.
              <br />
              Conteúdo vira oportunidade.
            </p>
          </div>
          <div>
            <strong>Produto</strong>
            <a href="#produtos">Produtos</a>
            <a href="#content-kits">Content Kits</a>
            <a href="#como-funciona">Como funciona</a>
          </div>
          <div>
            <strong>Empresa</strong>
            <span className="footer-disabled">Sobre</span>
            <span className="footer-disabled">Contato</span>
          </div>
          <div>
            <strong>Legal</strong>
            <Link href="/termos">Termos</Link>
            <Link href="/privacidade">Privacidade</Link>
          </div>
          <div>
            <strong>Social</strong>
            <span className="footer-disabled">TikTok</span>
            <span className="footer-disabled">Instagram</span>
            <span className="footer-disabled">LinkedIn</span>
          </div>
        </div>
        <div className="shell footer-bottom">© 2026 TemTrend. Todos os direitos reservados.</div>
      </footer>
    </>
  );
}
