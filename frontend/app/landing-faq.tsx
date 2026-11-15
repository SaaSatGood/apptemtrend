"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import Icon from "@/components/ui/Icon";
import { faqs } from "@/lib/landing-data";

// Mesmas perguntas da landing, agrupadas como no painel de dúvidas.
const FAQ_GROUPS: Array<{ label: string; indexes: number[] }> = [
  { label: "Começar", indexes: [0, 1, 2, 7] },
  { label: "Produção", indexes: [3, 4, 6] },
  { label: "Vendas e publicação", indexes: [5, 8, 9] },
];

export default function LandingFaq() {
  const [tab, setTab] = useState(0);
  const [open, setOpen] = useState(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const items = FAQ_GROUPS[tab].indexes
    .map((index) => faqs[index])
    .filter((item): item is [string, string] => Boolean(item));

  function selectTab(index: number) {
    setTab(index);
    setOpen(0);
  }

  function handleTabKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const next = (tab + direction + FAQ_GROUPS.length) % FAQ_GROUPS.length;
    selectTab(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <section className="tt-lp-faq" id="faq" aria-labelledby="faq-title">
      <div className="tt-lp-faq-panel">
        <div className="tt-lp-faq-grid">
          <div className="tt-lp-faq-copy" data-reveal>
            <span className="tt-lp-kicker is-light">Dúvidas</span>
            <h2 id="faq-title">Antes de <em>apertar REC.</em></h2>
            <p>
              Sem promessa de venda garantida: a TemTrend ajuda você a decidir,
              planejar e acompanhar o que produz.
            </p>
            <div className="tt-lp-faq-support">
              <span className="tt-lp-faq-support-dot" aria-hidden="true" />
              <strong>Ainda com dúvida?</strong>
              <p>A gente explica tudo numa conversa rápida, do jeito da sua rotina.</p>
              <Link className="tt-lp-btn tt-lp-btn-light" href="/suporte">
                Falar com suporte
                <Icon name="arrow-right" size={18} />
              </Link>
            </div>
          </div>

          <div className="tt-lp-faq-body" data-reveal>
            <div
              className="tt-lp-faq-tabs"
              role="tablist"
              aria-label="Categorias de dúvidas"
              onKeyDown={handleTabKeys}
            >
              {FAQ_GROUPS.map((group, index) => (
                <button
                  key={group.label}
                  ref={(node) => { tabRefs.current[index] = node; }}
                  type="button"
                  role="tab"
                  id={`faq-tab-${index}`}
                  aria-selected={index === tab}
                  aria-controls="faq-panel"
                  tabIndex={index === tab ? 0 : -1}
                  onClick={() => selectTab(index)}
                >
                  {group.label}
                </button>
              ))}
            </div>

            <div
              key={tab}
              className="tt-lp-faq-list"
              id="faq-panel"
              role="tabpanel"
              aria-labelledby={`faq-tab-${tab}`}
            >
              {items.map(([question, answer], index) => {
                const isOpen = index === open;
                const answerId = `faq-answer-${tab}-${index}`;
                return (
                  <div className={`tt-lp-faq-item${isOpen ? " is-open" : ""}`} key={question}>
                    <h3 className="tt-lp-faq-question">
                      <button
                        type="button"
                        className="tt-lp-faq-q"
                        aria-expanded={isOpen}
                        aria-controls={answerId}
                        onClick={() => setOpen(isOpen ? -1 : index)}
                      >
                        <span>{question}</span>
                        <span className="tt-lp-faq-icon" aria-hidden="true">
                          <Icon className="tt-lp-faq-icon-plus" name="plus" size={16} />
                          <Icon className="tt-lp-faq-icon-minus" name="minus" size={16} />
                        </span>
                      </button>
                    </h3>
                    <div className="tt-lp-faq-a" id={answerId}>
                      <div className="tt-lp-faq-a-inner">
                        <p>{answer}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
