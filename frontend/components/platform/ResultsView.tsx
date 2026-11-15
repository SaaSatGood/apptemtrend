"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon, { type IconName } from "@/components/ui/Icon";
import { track } from "@/lib/track";
import { usePlatform } from "./store";

const WAITLIST_KEY = "temtrend-results-waitlist";

const FEATURES: Array<{ icon: IconName; title: string; text: string }> = [
  {
    icon: "smartphone",
    title: "Conecte suas contas",
    text: "TikTok Shop, TikTok e Instagram autorizados uma única vez. Nada de print de tela ou planilha paralela.",
  },
  {
    icon: "video",
    title: "Views e alcance",
    text: "Veja quantas pessoas assistiram a cada vídeo e compare o alcance entre formatos e produtos.",
  },
  {
    icon: "shopping-bag",
    title: "Vendas e comissão",
    text: "Acompanhe pedidos, receita e comissão gerados por cada conteúdo, atualizados automaticamente.",
  },
  {
    icon: "trending-up",
    title: "O que funciona melhor",
    text: "Descubra os temas, produtos e horários que mais convertem para repetir o acerto no próximo vídeo.",
  },
];

const STEPS: Array<{ title: string; text: string }> = [
  { title: "Conecte suas contas", text: "Autorize TikTok Shop e redes sociais com segurança, em um clique." },
  { title: "Publique como sempre", text: "A TemTrend reconhece seus vídeos e cruza cada um com o produto certo." },
  { title: "Acompanhe os números", text: "Views, vendas e comissão aparecem juntos, sem trocar de ferramenta." },
];

const CHART_BARS = [42, 58, 47, 74, 63, 88, 96];
const CHART_DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export default function ResultsView() {
  const { toast } = usePlatform();
  const [notified, setNotified] = useState(false);

  // Preferência local lida depois do primeiro paint (sem quebrar a hidratação).
  useEffect(() => {
    try {
      if (window.localStorage.getItem(WAITLIST_KEY) === "true") queueMicrotask(() => setNotified(true));
    } catch {
      /* preferência opcional */
    }
  }, []);

  function joinWaitlist() {
    if (notified) return;
    setNotified(true);
    try {
      window.localStorage.setItem(WAITLIST_KEY, "true");
    } catch {
      /* preferência opcional */
    }
    track("results_waitlist_click", { source: "results_page" });
    toast("Interesse registrado. Este recurso ainda está em desenvolvimento.");
  }

  return (
    <div className="tt-results">
      <header className="tt-results-head">
        <span className="tt-results-badge"><Icon name="clock" size={13} /> Em breve</span>
        <h1>Seus resultados, <span className="tt-hl">em um só lugar</span>.</h1>
        <p>
          Estamos construindo um painel para você conectar suas contas e ver o que cada conteúdo realmente entregou:
          views, vendas e comissão, sem planilha e sem trocar de aba.
        </p>
      </header>

      <section className="tt-results-preview" aria-labelledby="results-preview-title">
        <div className="tt-results-preview-head">
          <div>
            <p className="eyebrow">Visão geral</p>
            <h2 id="results-preview-title">Desempenho dos seus conteúdos</h2>
          </div>
          <span className="tt-results-preview-tag">Prévia</span>
        </div>

        <div className="tt-results-metrics" aria-hidden="true">
          <div className="tt-results-metric">
            <small>Views</small>
            <strong>128,4 mil</strong>
            <em>+32% na semana</em>
          </div>
          <div className="tt-results-metric">
            <small>Vendas</small>
            <strong>184</strong>
            <em>+18% na semana</em>
          </div>
          <div className="tt-results-metric">
            <small>Comissão</small>
            <strong>R$ 2.480</strong>
            <em>+21% na semana</em>
          </div>
        </div>

        <div className="tt-results-chart" aria-hidden="true">
          {CHART_BARS.map((value, index) => (
            <span key={CHART_DAYS[index]} className="tt-results-bar">
              <i style={{ height: `${value}%` }} />
              <small>{CHART_DAYS[index]}</small>
            </span>
          ))}
        </div>

        <p className="tt-results-preview-note">
          Prévia ilustrativa. Os números reais aparecem assim que você conectar suas contas.
        </p>
      </section>

      <section className="tt-results-features" aria-labelledby="results-features-title">
        <h2 id="results-features-title">O que você vai conseguir fazer</h2>
        <div className="tt-results-grid">
          {FEATURES.map((feature) => (
            <article key={feature.title} className="tt-results-card">
              <span className="tt-results-card-icon" aria-hidden="true"><Icon name={feature.icon} size={18} /></span>
              <strong>{feature.title}</strong>
              <p>{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="tt-results-steps" aria-labelledby="results-steps-title">
        <h2 id="results-steps-title">Como vai funcionar</h2>
        <ol>
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <b aria-hidden="true">{index + 1}</b>
              <strong>{step.title}</strong>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <aside className="tt-results-cta">
        <div className="tt-results-cta-copy">
          <strong>Quer saber quando abrir?</strong>
          <p>Deixe seu interesse registrado. Avisamos você aqui dentro assim que os Resultados entrarem no ar.</p>
        </div>
        <div className="tt-results-cta-actions">
          <button type="button" onClick={joinWaitlist} disabled={notified}>
            {notified ? "Interesse registrado" : "Tenho interesse"}
            <Icon name={notified ? "check" : "arrow-right"} size={16} />
          </button>
          <Link className="tt-results-link" href="/descobrir">Descobrir produtos</Link>
        </div>
      </aside>
    </div>
  );
}
