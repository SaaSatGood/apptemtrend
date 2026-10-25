"use client";

const STEPS = [
  {
    title: "Busque uma oportunidade",
    copy: "Descreva o que quer vender ou use os filtros de preço, nicho e nível.",
  },
  {
    title: "Compare os dados",
    copy: "Veja os produtos lado a lado e escolha o que faz mais sentido para você.",
  },
  {
    title: "Grave com roteiro pronto",
    copy: "A TemTrend monta o roteiro. Você só liga a câmera e grava.",
  },
];

/** Os três passos da descoberta, no mesmo card do painel. */
export default function HowItWorks() {
  return (
    <section className="tt-how" aria-labelledby="tt-how-title">
      <h2 id="tt-how-title">Como funciona</h2>
      <ol className="tt-how-grid">
        {STEPS.map((step, index) => (
          <li key={step.title} className="tt-how-card">
            <span className="tt-how-number" aria-hidden="true">{index + 1}</span>
            <div>
              <strong>{step.title}</strong>
              <p>{step.copy}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
