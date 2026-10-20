import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { faqs, reelMedia } from "../lib/landing-data";
import LandingPlans from "./landing-plans";

// Carrossel abaixo da dobra: JS separado, fora do bundle inicial.
const CreatorCarousel = dynamic(() => import("./creator-carousel"), {
  loading: () => <div className="tt-carousel" aria-hidden="true" />,
});

const planParts = [
  ["01", "Conceito", "O ângulo que dá sentido ao vídeo."],
  ["02", "Abertura", "A primeira frase para prender atenção."],
  ["03", "Cenas", "O que mostrar em cada tomada."],
  ["04", "Roteiro", "O que falar, na ordem certa."],
  ["05", "Legenda", "O texto que acompanha o post."],
  ["06", "Chamada final", "O próximo passo para quem assistiu."],
  ["07", "Hashtags", "Termos para ajudar na descoberta."],
  ["08", "Áudio e duração", "Ritmo e tempo sugeridos para gravar."],
];

const examples = [
  ["01", "Lifestyle", "Garrafa térmica", "Mostre o uso no dia a dia."],
  ["02", "Tecnologia", "Fone sem fio", "Demonstre uma função concreta."],
  ["03", "Beleza", "Escova facial", "Grave uma rotina curta de uso."],
];

export default function LandingRebuild() {
  return (
    <>
      <section className="tt-rd-opening" id="como-funciona" aria-labelledby="opening-title">
        <div className="tt-rd-shell tt-rd-opening-grid">
          <div className="tt-rd-opening-copy">
            <span className="tt-rd-kicker">Da dúvida ao próximo vídeo</span>
            <h2 id="opening-title">O produto é o começo. <em>O plano põe você em movimento.</em></h2>
            <p>Escolha uma oportunidade, receba uma direção de conteúdo e grave com um plano claro. A TemTrend organiza o caminho sem fingir que faz o trabalho por você.</p>
            <a className="tt-rd-text-link" href="#content-kits">Veja o que vem no plano</a>
          </div>
          <div className="tt-rd-opening-art" role="img" aria-label="Da pergunta sobre o produto ao plano de gravação">
            <div className="tt-rd-question">
              <span>O PONTO DE PARTIDA</span>
              <p>“Produto escolhido. <em>O que eu gravo?</em>”</p>
              <div className="tt-rd-question-line" aria-hidden="true" />
            </div>
            <div className="tt-rd-answer">
              <span>COM A TEMTREND</span>
              <strong>Produto <i>→</i> ideia <i>→</i> plano <i>→</i> REC</strong>
              <div className="tt-rd-rec" aria-hidden="true"><b /> REC</div>
            </div>
          </div>
        </div>
      </section>

      <section className="tt-rd-workflow" aria-labelledby="workflow-title">
        <div className="tt-rd-shell">
          <div className="tt-rd-section-heading">
            <h2 id="workflow-title">Um produto.<br /><em>Três decisões.</em></h2>
          </div>
          <div className="tt-rd-workflow-list">
            <article className="tt-rd-workflow-step">
              <span className="tt-rd-step-index">01 / Descubra</span>
              <div><h3>Escolha o que vale testar.</h3><p>Compare produtos e encontre um ponto de partida para o seu conteúdo.</p></div>
              <div className="tt-rd-step-visual tt-rd-step-product" aria-hidden="true"><span>PRODUTO ESCOLHIDO</span><b>Garrafa térmica</b><i>↗</i></div>
            </article>
            <article className="tt-rd-workflow-step">
              <span className="tt-rd-step-index">02 / Planeje</span>
              <div><h3>Saiba o que mostrar e falar.</h3><p>Transforme a escolha em abertura, cenas, roteiro e chamada final.</p></div>
              <div className="tt-rd-step-visual tt-rd-step-script" aria-hidden="true"><span>PLANO DE GRAVAÇÃO</span><b>Mostre o detalhe que muda a rotina.</b><small>01  Abertura &nbsp; 02  Demonstração &nbsp; 03  CTA</small></div>
            </article>
            <article className="tt-rd-workflow-step">
              <span className="tt-rd-step-index">03 / Grave</span>
              <div><h3>Publique no seu ritmo.</h3><p>Adapte o roteiro, grave com o celular e acompanhe sua produção até publicar.</p></div>
              <div className="tt-rd-step-visual tt-rd-step-video" aria-hidden="true"><span>PRONTO PARA GRAVAR</span><b><i /> Seu próximo vídeo</b><small>O REC continua com você.</small></div>
            </article>
          </div>
        </div>
      </section>

      <section className="tt-rd-kit" id="content-kits" aria-labelledby="kit-title">
        <div className="tt-rd-shell">
          <div className="tt-rd-kit-top">
            <div><span className="tt-rd-kicker">Por dentro do plano</span><h2 id="kit-title">A ideia é só o começo. <em>O plano faz ela andar.</em></h2></div>
            <p>Em vez de uma sugestão solta, você recebe as decisões criativas organizadas para gravar. O exemplo abaixo mostra como isso pode tomar forma.</p>
          </div>
          <div className="tt-rd-kit-layout">
            <div className="tt-rd-kit-sheet" aria-label="Exemplo ilustrativo de plano de gravação para garrafa térmica">
              <div className="tt-rd-kit-sheet-head"><span>TEMTREND / EXEMPLO DE PLANO</span><span>01—08</span></div>
              <h3>Garrafa térmica<br /><em>no dia a dia.</em></h3>
              <div className="tt-rd-kit-hook"><small>ABERTURA</small><p>“Quanto tempo sua bebida fica do jeito que você gosta?”</p></div>
              <div className="tt-rd-kit-scenes"><span><b>01</b> Mostre a rotina</span><span><b>02</b> Aproxime o produto</span><span><b>03</b> Demonstre o uso</span></div>
              <div className="tt-rd-kit-sheet-foot"><span>ROTEIRO · LEGENDA · CTA</span><b>Pronto para adaptar ↗</b></div>
            </div>
            <div className="tt-rd-kit-parts" aria-label="Oito partes de um plano de gravação">
              {planParts.map(([number, title, description]) => (
                <div key={number}><span>{number}</span><div><strong>{title}</strong><p>{description}</p></div></div>
              ))}
            </div>
          </div>
          <Link className="tt-rd-button tt-rd-button-lime" href="/app?mode=signup">Começar agora</Link>
        </div>
      </section>

      <section className="tt-rd-products" id="produtos" aria-labelledby="products-title">
        <div className="tt-rd-shell">
          <div className="tt-rd-products-head"><div><h2 id="products-title">Ideias de produto para <em>explorar.</em></h2></div><p>Veja como objetos comuns podem render demonstrações simples. Os itens abaixo são exemplos visuais; as oportunidades atuais aparecem na plataforma.</p></div>
          <figure className="tt-rd-product-photo">
            <Image src="/product-still-life.png" alt="Garrafa térmica rosa, fone sem fio preto e escova facial branca em um cenário de estúdio" width={1536} height={1024} sizes="(max-width: 760px) 100vw, 1320px" />
            <figcaption>Exemplos ilustrativos de produtos para conteúdo</figcaption>
          </figure>
          <div className="tt-rd-example-list">
            {examples.map(([number, category, name, idea]) => (
              <article key={number}><span>{number}</span><div><small>{category}</small><h3>{name}</h3></div><p>{idea}</p></article>
            ))}
          </div>
          <Link className="tt-rd-text-link" href="/app?mode=signup">Começar agora</Link>
        </div>
      </section>

      <section className="tt-creator-reel tt-rd-reel" aria-labelledby="reel-title">
        <div className="tt-rd-shell">
          <div className="tt-rd-reel-head">
            <div><span className="tt-rd-kicker">Do plano ao REC</span><h2 id="reel-title">O vídeo não precisa ser perfeito. <em>Precisa existir.</em></h2></div>
            <p>Comece com o que você tem: um celular, um produto e uma ideia clara. Use os exemplos como inspiração e adapte cada gravação ao seu jeito.</p>
          </div>
          <div className="tt-rd-reel-guide" aria-label="Três passos para começar a gravar">
            <span><b>01</b> Escolha um ângulo</span><span><b>02</b> Apoie o celular</span><span><b>03</b> Grave uma tomada</span>
          </div>
          <CreatorCarousel videos={reelMedia} />
        </div>
      </section>

      <LandingPlans />

      <section className="tt-rd-faq" id="faq" aria-labelledby="faq-title">
        <div className="tt-rd-shell tt-rd-faq-grid">
          <div className="tt-rd-faq-intro"><h2 id="faq-title">Tudo claro antes de <em>apertar REC.</em></h2><p>Sem promessa de venda garantida: a TemTrend ajuda você a decidir, planejar e acompanhar o que produz.</p></div>
          <div className="tt-rd-faq-list">
            {faqs.map(([question, answer], index) => (
              <details key={question}><summary><span>{String(index + 1).padStart(2, "0")}</span><strong>{question}</strong><i aria-hidden="true">+</i></summary><p>{answer}</p></details>
            ))}
          </div>
        </div>
      </section>

      <section className="tt-rd-final" aria-labelledby="final-title"><div className="tt-rd-shell tt-rd-final-inner"><span className="tt-rd-kicker">O próximo passo é seu</span><h2 id="final-title">Seu próximo vídeo começa com <em>uma decisão.</em></h2><p>Encontre um produto, pegue o plano e grave do seu jeito.</p><Link className="tt-rd-button tt-rd-button-dark" href="/app?mode=signup">Começar agora</Link></div></section>
    </>
  );
}

export function LandingFooter() {
  return (
    <footer className="tt-rd-footer"><div className="tt-rd-shell tt-rd-footer-main"><div><a className="tt-rd-footer-logo" href="#top" aria-label="TemTrend, voltar ao início"><span aria-hidden="true">T</span><strong>TemTrend</strong></a><p>Produto vira conteúdo.<br />Conteúdo vira oportunidade.</p></div><nav aria-label="Links do rodapé"><a href="#como-funciona">Como funciona</a><a href="#content-kits">Plano de gravação</a><a href="#produtos">Produtos</a><a href="#planos">Planos</a><a href="#faq">FAQ</a></nav><div className="tt-rd-footer-legal"><Link href="/app">Entrar</Link><Link href="/termos">Termos de uso</Link><Link href="/privacidade">Privacidade</Link><Link href="/reembolso">Reembolso</Link></div></div><div className="tt-rd-shell tt-rd-footer-bottom"><span>© 2026 TemTrend</span><span>Feito para quem cria e executa.</span></div></footer>
  );
}
