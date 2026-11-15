import Image from "next/image";
import Link from "next/link";
import Icon from "@/components/ui/Icon";

export default function LandingHero() {
  return (
    <section className="tt-hr-hero" aria-labelledby="hero-title">
      <div className="tt-hr-copy">
        <h1 id="hero-title">
          Descubra o que vender.
          <span className="tt-hr-head-line">
            Crie vídeos para <span className="tt-hr-highlight">vender</span>
          </span>
        </h1>

        <p className="tt-hr-sub">
          Encontre produtos do TikTok Shop com potencial de venda e receba
          roteiros prontos para transformar ideias em vídeos.
        </p>

        <div className="tt-hr-actions">
          <Link className="tt-hr-cta" href="/descobrir?mode=signup">
            Encontrar produto
            <Icon name="arrow-right" size={18} />
          </Link>
          <a className="tt-hr-secondary" href="#como-funciona">
            Ver como funciona
          </a>
        </div>
      </div>

      <div className="tt-hr-shot" aria-hidden="true">
        <div className="tt-hr-window">
          <div className="tt-hr-window-bar">
            <span className="tt-hr-dots"><i /><i /><i /></span>
            <span className="tt-hr-url">
              <Image src="/temtrend-mark.svg" alt="" width={16} height={16} />
              www.temtrend.com/descobrir
            </span>
          </div>

          <div className="tt-hr-app">
            <aside className="tt-hr-side">
              <div className="tt-hr-side-brand">
                <span aria-hidden="true">T</span>
                <strong>TemTrend</strong>
              </div>
              <nav className="tt-hr-side-nav">
                <span className="is-active"><Icon name="compass" size={15} /> Descobrir</span>
                <span><Icon name="box" size={15} /> Produtos</span>
                <span><Icon name="video" size={15} /> Conteúdos</span>
                <span><Icon name="calendar" size={15} /> Calendário</span>
                <span><Icon name="dashboard" size={15} /> Resultados</span>
              </nav>
              <div className="tt-hr-side-plan">
                <small>Plano atual</small>
                <strong>Grátis</strong>
                <span>Acesso ativo</span>
              </div>
            </aside>

            <div className="tt-hr-main">
              <div className="tt-hr-main-top">
                <div>
                  <span>Descobrir</span>
                  <strong>Encontre a próxima oportunidade.</strong>
                </div>
                <span className="tt-hr-user">C</span>
              </div>

              <div className="tt-hr-search">
                <Icon name="search" size={15} />
                garrafa térmica para demonstrar
              </div>

              <div className="tt-hr-catalog">
                <article className="tt-hr-product">
                  <div className="tt-hr-product-media">
                    <Image
                      src="/hero-tumbler-v2.png"
                      alt=""
                      width={1536}
                      height={1024}
                      sizes="(max-width: 760px) 220px, 320px"
                    />
                    <span>92/100 em alta</span>
                  </div>
                  <div className="tt-hr-product-body">
                    <small><Icon name="check" size={11} /> Produto encontrado</small>
                    <strong>Garrafa térmica 1,2 L</strong>
                    <div className="tt-hr-product-meta">
                      <b>R$ 49,90</b>
                      <em>12% de comissão</em>
                    </div>
                    <span className="tt-hr-product-sales">2,4 mil vendas no período</span>
                  </div>
                </article>

                <article className="tt-hr-plan">
                  <header>
                    <strong><Icon name="sparkles" size={14} /> Roteiro gerado</strong>
                    <span>Pronto</span>
                  </header>
                  <ol>
                    <li>
                      <b>01</b>
                      <span>Abertura<small>“Quanto tempo sua bebida fica gelada?”</small></span>
                    </li>
                    <li>
                      <b>02</b>
                      <span>Demonstração<small>Mostre o gelo e a tampa na prática.</small></span>
                    </li>
                    <li>
                      <b>03</b>
                      <span>Chamada final<small>“E ela no vídeo?”</small></span>
                    </li>
                  </ol>
                  <div className="tt-hr-plan-foot">
                    <span>3 cenas · 32 s</span>
                    <span>Legenda + hashtags</span>
                  </div>
                </article>
              </div>

              <section className="tt-hr-result">
                <header className="tt-hr-result-head">
                  <strong><Icon name="video" size={14} /> Resultado final</strong>
                  <span>Pronto para gravar</span>
                </header>
                <div className="tt-hr-result-body">
                  <div className="tt-hr-result-video">
                    <Image
                      src="/hero-tumbler-v2.png"
                      alt=""
                      width={1536}
                      height={1024}
                      sizes="140px"
                    />
                    <i className="tt-hr-result-play" />
                    <b>0:32</b>
                  </div>
                  <div className="tt-hr-result-copy">
                    <p>“Sua bebida ficou 8 horas gelada — olha o tamanho do gelo.”</p>
                    <div className="tt-hr-result-tags">
                      <span>#tiktokshop</span>
                      <span>#achadinhos</span>
                      <span>#garrafatermica</span>
                    </div>
                    <span className="tt-hr-result-audio">
                      <Icon name="sparkles" size={11} /> Áudio em alta · 42 mil vídeos
                    </span>
                  </div>
                  <span className="tt-hr-result-cta">
                    <Icon name="copy" size={12} /> Copiar roteiro
                  </span>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
