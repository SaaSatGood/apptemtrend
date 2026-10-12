import Image from "next/image";
import Link from "next/link";
import { faqs, peoplePhotos, products, profiles, reelMedia } from "../lib/landing-data";
import LandingHero from "./landing-hero";
import LandingMenu from "./landing-menu";
import LandingMotion from "./landing-motion";
import CreatorCarousel from "./creator-carousel";

const kitSteps = [
  ["01", "Escolha o produto", "Sem planilha, sem curso. Aponte para uma oportunidade real."],
  ["02", "Pegue o plano de gravação", "Abertura, roteiro, cenas, chamada final e hashtags — tudo mastigado."],
  ["03", "Grave e publique", "Adapte ao seu jeito, grave com o celular e coloque seu vídeo para vender."],
];

const featureCards = [
  ["↗", "Produtos para avaliar", "Um catálogo organizado para você comparar oportunidades e decidir com clareza."],
  ["✦", "Ideias que viram vídeo", "Cada produto já nasce com um ângulo de conteúdo. Você nunca parte do zero."],
  ["≡", "Roteiro sem enrolação", "Abertura, meio e fim escritos para prender atenção e empurrar para a compra."],
  ["◎", "Cenas passo a passo", "O que mostrar, o que falar, quando cortar. É só apertar o REC."],
];

const kitContents = [
  ["01", "Conceito", "O ângulo matador do vídeo: o que mostrar e por que ninguém vai pular."],
  ["02", "Abertura (hook)", "A primeira frase que prende — sem ela, o resto nem existe."],
  ["03", "Cenas", "Tomada por tomada, com ação e fala. Improviso zero na hora de gravar."],
  ["04", "Roteiro", "A mensagem completa, da primeira palavra à chamada final."],
  ["05", "Legenda (copy)", "O texto que acompanha o post e reforça a venda."],
  ["06", "Chamada final (CTA)", "A frase que diz exatamente o que fazer: comprar."],
  ["07", "Hashtags", "As tags certas para o vídeo ser encontrado por quem compra."],
  ["08", "Áudio e duração", "Ritmo, trilha e tempo: o plano técnico para gravar rápido."],
];

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

        <section className="tt-section tt-creator-reel">
          <div className="tt-shell">
            <span className="tt-eyebrow">Chega de desculpas</span>
            <h2>A ideia perfeita não existe. <em>O plano pronto, sim.</em></h2>
            <CreatorCarousel videos={reelMedia} />
            <Link className="tt-btn tt-btn-lime" href="/app?mode=signup">Quero meu plano agora <span>↗</span></Link>
          </div>
        </section>

        <section className="tt-section tt-intro" id="como-funciona">
          <div className="tt-shell">
            <span className="tt-eyebrow">O jogo é simples</span>
            <h2>Do produto ao publicado. <em>Sem adivinhação.</em></h2>
            <div className="tt-story-stack">
              <article className="tt-story tt-story-light">
                <div className="tt-story-copy"><span>01 · DESCUBRA</span><h3>Decida hoje o que você vai vender.</h3><p>Rolagem infinita não paga conta. Escolha um produto de verdade e transforme em conteúdo que vende.</p><ul><li>Produtos reais organizados por categoria</li><li>Dados para decidir sem chute</li><li>Do produto direto para o roteiro</li></ul></div>
                <div className="tt-catalog-mockup">
                  {products.slice(0, 3).map((product) => <div key={product.name}><Image src={product.image} alt="" width={320} height={240} /><small>{product.category}</small><strong>{product.name}</strong><span>Explorar</span></div>)}
                </div>
              </article>

              <article className="tt-story tt-story-lime" id="content-kits">
                <div className="tt-story-copy"><span>02 · PLANEJE</span><h3>Nunca mais trave na frente da câmera.</h3><p>O plano mastiga tudo: abertura, roteiro, cenas. Você adapta ao seu jeito e grava sem medo.</p><ul><li>Abertura que segura a atenção</li><li>Roteiro e cenas passo a passo</li><li>Legenda, chamada final e hashtags inclusos</li></ul></div>
                <div className="tt-kit-mockup">
                  <div className="tt-kit-top"><span>PLANO DE GRAVAÇÃO</span><b>Massageador facial</b><i>•••</i></div>
                  <div className="tt-kit-hook"><small>HOOK</small><strong>“Você precisa ver isso antes de comprar...”</strong></div>
                  <div className="tt-kit-scenes"><span><b>01</b> Mostre o problema</span><span><b>02</b> Aproxime o produto</span><span><b>03</b> Demonstre o uso</span></div>
                  <div className="tt-kit-script"><small>ROTEIRO</small><p>Comece mostrando a situação. Apresente o produto e demonstre o benefício em poucos segundos.</p></div>
                  <div className="tt-kit-bottom"><span>#tiktokshop &nbsp; #achadinhos</span><span className="tt-kit-done">Pronto para gravar ✓</span></div>
                </div>
              </article>

              <article className="tt-story tt-story-dark">
                <div className="tt-story-copy"><span>03 · PUBLIQUE</span><h3>Aperte o REC. O resto é com você.</h3><p>Roteiro na mão, celular no tripé. Grave, publique e acompanhe cada etapa até a venda.</p><ul><li>Grave só com o seu celular</li><li>Acompanhe cada etapa da produção</li><li>Publique para vender, não por hobby</li></ul></div>
                <div className="tt-publish-mockup">
                  <div className="tt-phone"><Image src={peoplePhotos[0].src} alt="Creator gravando um vídeo vertical" width={360} height={600} /><div><span>Seu vídeo</span><strong>Pronto para publicar</strong></div></div>
                  <div className="tt-checklist"><span><i>✓</i> Hook</span><span><i>✓</i> Roteiro</span><span><i>✓</i> Cenas</span><span><i>✓</i> CTA</span><b>Agora é com você ↗</b></div>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="tt-section tt-kit-breakdown" aria-labelledby="kit-breakdown-title">
          <div className="tt-shell">
            <div className="tt-kit-breakdown-head">
              <div>
                <span className="tt-eyebrow">O que você recebe</span>
                <h2 id="kit-breakdown-title">Produto todo mundo acha. <em>O plano, só aqui.</em></h2>
              </div>
              <p>Gravar no escuro é escolha. A TemTrend entrega cada decisão criativa mastigada — você para de improvisar e começa a publicar.</p>
            </div>
            <div className="tt-kit-breakdown-grid">
              {kitContents.map(([number, title, body]) => (
                <article className="tt-kit-piece" key={number}>
                  <span>{number}</span>
                  <div><h3>{title}</h3><p>{body}</p></div>
                  <b aria-hidden="true">↗</b>
                </article>
              ))}
            </div>
            <div className="tt-kit-breakdown-cta">
              <p>Cada dia sem roteiro é um vídeo a menos no ar.</p>
              <Link className="tt-btn" href="/app?mode=signup">Quero meu plano agora <span>↗</span></Link>
            </div>
          </div>
        </section>

        <section className="tt-section tt-numbers"><div className="tt-shell"><div className="tt-numbers-head"><h2>Menos desculpa.<br />Mais vídeo no ar.</h2><p>Você não precisa de mais um curso. Precisa de um produto, um roteiro e o botão de gravar.</p></div><div className="tt-number-grid"><article><span className="tt-number-icon" aria-hidden="true">↗</span><strong>01</strong><span>produto para começar</span><p>Uma decisão hoje vale mais que um mês planejando.</p></article><article><span className="tt-number-icon" aria-hidden="true">✦</span><strong>08</strong><span>partes no plano de gravação</span><p>Da abertura à legenda: tudo mastigado, nada no improviso.</p></article><article className="tt-number-dark"><span className="tt-number-icon" aria-hidden="true">✓</span><strong>0</strong><span>motivos para começar do zero</span><p>Adapte ao seu jeito e parta para a gravação.</p></article></div></div></section>

        <section className="tt-section tt-features">
          <div className="tt-shell">
            <span className="tt-eyebrow">Tudo num só lugar</span><h2>Ideia solta não vende. <em>Sistema vende.</em></h2><p className="tt-section-lead">Chega de anotação perdida e vídeo que nunca sai. Aqui, produto vira plano e plano vira publicação.</p>
            <div className="tt-feature-grid">
              <article className="tt-feature-main tt-feature-green"><div><span>01</span><h3>Roteiro que tira você do zero</h3><p>Nada de página em branco. Um guia visual e direto, do conceito à chamada final.</p></div><div className="tt-mini-document"><i>CONCEITO</i><strong>Transforme o produto em uma história curta.</strong><span>ABERTURA</span><span>CENAS</span><span>ROTEIRO</span><b>CHAMADA FINAL →</b></div></article>
              <article className="tt-feature-main tt-feature-blue"><div><span>02</span><h3>Feito para gente real</h3><p>Sem estúdio, sem equipe, sem seguidor milagroso. Seu celular basta.</p></div><div className="tt-photo-pair"><Image src={peoplePhotos[1].src} alt="Creator preparando conteúdo" width={420} height={420} /><Image src={peoplePhotos[2].src} alt="Creator gravando conteúdo" width={420} height={420} /></div></article>
              {featureCards.map(([icon, title, body]) => <article className="tt-feature-small" key={title}><i>{icon}</i><h3>{title}</h3><p>{body}</p></article>)}
            </div>
          </div>
        </section>

        <section className="tt-dark-section"><div className="tt-shell"><span className="tt-eyebrow">A verdade nua</span><h2>Influencer posta por status.<br /><em>Você vai postar para vender.</em></h2><div className="tt-audience-grid">{profiles.map(([number, title, body], index) => <article key={title}><Image src={peoplePhotos[index].src} alt={`${title} criando conteúdo`} width={500} height={420} /><div><span>{number}</span><h3>{title}</h3><p>{body}</p></div></article>)}</div><div className="tt-dark-quote"><span>PARA QUEM EXECUTA</span><p>“Quem publica, aprende.<br />Quem espera a ideia perfeita, <em>assiste.</em>”</p><Link className="tt-btn tt-btn-lime" href="/app?mode=signup">Quero começar ↗</Link></div></div></section>

        <section className="tt-section tt-products" id="produtos"><div className="tt-shell"><span className="tt-eyebrow">Um ponto de partida</span><h2>Ideias de produto para <em>explorar.</em></h2><p className="tt-section-lead">Veja exemplos de categorias e descubra opções no catálogo da TemTrend.</p><div className="tt-product-grid">{products.map((product, index) => <article key={product.name}><div className="tt-product-image"><Image src={product.image} alt={product.name} width={700} height={520} loading="lazy" /><span>0{index + 1}</span></div><small>{product.category}</small><h3>{product.name}</h3><Link href="/app?mode=signup">Explorar catálogo <span>↗</span></Link></article>)}</div></div></section>

        <section className="tt-section tt-steps"><div className="tt-shell"><div className="tt-steps-head"><span className="tt-eyebrow">Sem mistério</span><h2>Três passos.<br />Zero desculpa.</h2></div><div className="tt-steps-list">{kitSteps.map(([number, title, body]) => <article key={number}><span>{number}</span><div><h3>{title}</h3><p>{body}</p></div><i>↗</i></article>)}</div></div></section>

        <section className="tt-section tt-faq" id="faq">
          <div className="tt-shell tt-faq-shell">
            <div className="tt-faq-intro">
              <span className="tt-eyebrow">Perguntas frequentes</span>
              <h2>Dúvida também é desculpa.<br /><em>Acabe com elas.</em></h2>
              <p>Tudo que você precisa saber antes de apertar o REC — sem enrolação.</p>
              <div className="tt-faq-invite">
                <span>ÚLTIMA CHAMADA</span>
                <strong>Daqui a 5 minutos você pode ter conta criada e produto escolhido.</strong>
                <Link href="/app?mode=signup">Criar minha conta <span aria-hidden="true">↗</span></Link>
              </div>
            </div>
            <div className="tt-faq-list">
              {faqs.map(([question, answer], index) => (
                <details key={question}>
                  <summary><small>{String(index + 1).padStart(2, "0")}</small><span className="tt-faq-question">{question}</span><span className="tt-faq-toggle" aria-hidden="true">+</span></summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="tt-final"><div className="tt-shell tt-final-card"><div><span>AMANHÃ VOCÊ VAI QUERER TER COMEÇADO HOJE</span><h2>Pare de adiar.<br />Comece a vender.</h2><p>Escolha um produto, pegue o plano e grave seu próximo vídeo.</p></div><Link className="tt-btn" href="/app?mode=signup">Criar minha conta grátis <span>↗</span></Link></div></section>
      </main>

      <footer className="tt-footer"><div className="tt-shell tt-footer-grid"><div><a className="tt-logo" href="#top"><span>T</span><b>TemTrend</b></a><p>Produto vira conteúdo.<br />Conteúdo vira oportunidade.</p></div><div><strong>Produto</strong><a href="#produtos">Produtos</a><a href="#content-kits">Plano de gravação</a><a href="#como-funciona">Como funciona</a></div><div><strong>Legal</strong><Link href="/termos">Termos</Link><Link href="/privacidade">Privacidade</Link></div><div><strong>Acesso</strong><Link href="/app">Entrar</Link><Link href="/app?mode=signup">Criar conta</Link></div></div><div className="tt-shell tt-footer-bottom"><span>© 2026 TemTrend</span><span>Feito para quem executa.</span></div></footer>
    </div>
  );
}
