"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import Icon from "@/components/ui/Icon";

const demos = [
  {
    id: "casa",
    label: "Casa",
    category: "Casa · acessórios",
    product: "Garrafa térmica",
    subtitle: "no dia a dia",
    hook: "“Quanto tempo sua bebida fica gelada?”",
    scenes: [
      "Mostre a garrafa na rotina da manhã.",
      "Aproxime o gelo, a tampa e o encaixe.",
      "Feche com o resultado do teste.",
    ],
  },
  {
    id: "beleza",
    label: "Beleza",
    category: "Beleza · skincare",
    product: "Escova facial",
    subtitle: "em 15 segundos",
    hook: "“Sua limpeza de pele cabe na rotina?”",
    scenes: [
      "Mostre a escova seca e o textinho.",
      "Grave a espuma e o movimento no rosto.",
      "Mostre a pele depois da limpeza.",
    ],
  },
  {
    id: "tech",
    label: "Tech",
    category: "Tech · áudio",
    product: "Fone sem fio",
    subtitle: "em uma demonstração rápida",
    hook: "“Qual fone some na sua rotina?”",
    scenes: [
      "Abra o estojo e mostre o encaixe.",
      "Coloque o fone e ative o som.",
      "Mostre o detalhe que muda a experiência.",
    ],
  },
];

const planParts = ["Roteiro", "Legenda", "Chamada final", "Hashtags", "Áudio e duração"];

export default function LandingDemo() {
  const [active, setActive] = useState(0);
  const baseId = useId();
  const tabsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const demo = demos[active];

  function moveTab(next: number) {
    const index = (next + demos.length) % demos.length;
    setActive(index);
    tabsRef.current[index]?.focus();
  }

  return (
    <section className="tt-lp-dark" id="plano" aria-labelledby="lp-demo-title">
      <div className="tt-lp-dark-glow" aria-hidden="true" />
      <div className="tt-lp-wrap tt-lp-dark-grid">
        <div className="tt-lp-dark-copy" data-reveal>
          <span className="tt-lp-kicker is-light">Por dentro do plano</span>
          <h2 id="lp-demo-title">Um plano <em>para gravar.</em></h2>
          <p>
            Cada plano organiza as decisões criativas para você gravar sem travar.
            Troque o exemplo ao lado e veja como isso toma forma.
          </p>
          <ul className="tt-lp-dark-list">
            <li><i aria-hidden="true"><Icon name="check" size={10} /></i> 8 partes organizadas por vídeo</li>
            <li><i aria-hidden="true"><Icon name="check" size={10} /></i> Exemplos para casa, beleza e tecnologia</li>
            <li><i aria-hidden="true"><Icon name="check" size={10} /></i> Editável para o seu estilo e a sua rotina</li>
          </ul>
          <Link className="tt-lp-btn tt-lp-btn-lime" href="/app?mode=signup">
            Criar meu primeiro plano
            <Icon name="arrow-right" size={18} />
          </Link>
        </div>

        <div className="tt-lp-plan-card" data-reveal>
          <div className="tt-lp-plan-tabs" role="tablist" aria-label="Escolha um exemplo de produto">
            {demos.map((item, index) => (
              <button
                key={item.id}
                ref={(element) => { tabsRef.current[index] = element; }}
                id={`${baseId}-tab-${index}`}
                type="button"
                role="tab"
                aria-selected={index === active}
                aria-controls={`${baseId}-panel`}
                tabIndex={index === active ? 0 : -1}
                onClick={() => setActive(index)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowRight") { event.preventDefault(); moveTab(active + 1); }
                  if (event.key === "ArrowLeft") { event.preventDefault(); moveTab(active - 1); }
                  if (event.key === "Home") { event.preventDefault(); moveTab(0); }
                  if (event.key === "End") { event.preventDefault(); moveTab(demos.length - 1); }
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div
            key={demo.id}
            id={`${baseId}-panel`}
            className="tt-lp-plan-sheet"
            role="tabpanel"
            aria-labelledby={`${baseId}-tab-${active}`}
            tabIndex={0}
          >
            <div className="tt-lp-plan-head">
              <div>
                <span>Exemplo de plano · {demo.category}</span>
                <h3>{demo.product} <em>{demo.subtitle}</em></h3>
              </div>
              <span className="tt-lp-plan-count">8 partes</span>
            </div>

            <div className="tt-lp-plan-hook">
              <span>Abertura</span>
              <p>{demo.hook}</p>
            </div>

            <ol className="tt-lp-plan-scenes">
              {demo.scenes.map((scene, index) => (
                <li key={scene}>
                  <b>{String(index + 1).padStart(2, "0")}</b>
                  <span>{scene}</span>
                  <i aria-hidden="true"><Icon name="arrow-up-right" size={12} /></i>
                </li>
              ))}
            </ol>

            <div className="tt-lp-plan-parts">
              {planParts.map((part) => <span key={part}>{part}</span>)}
            </div>

            <div className="tt-lp-plan-foot">
              <span><i aria-hidden="true" /> Pronto para adaptar</span>
              <span>Conceito incluído</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
