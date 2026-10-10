"use client";

import Link from "next/link";
import { usePlatform } from "./store";

export default function Opportunities() {
  const { productions } = usePlatform();
  const resume = [...productions]
    .filter((p) => p.status !== "publicado")
    .sort((a, b) => (b.atualizado_em || "").localeCompare(a.atualizado_em || ""))
    .slice(0, 3);

  if (!resume.length) return null;

  return (
    <section className="resume-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Seu próximo passo</p>
          <h2>Continue de onde parou</h2>
        </div>
        <Link className="text-button" href="/app/producao">Ver produção →</Link>
      </div>
      <div className="resume-grid">
        {resume.map((item) => (
          <Link
            key={item.id}
            className="resume-card"
            href={item.content_kit_id ? `/app/produtos/${item.product_id}/kits/${item.content_kit_id}` : `/app/produtos/${item.product_id}`}
          >
            <span className={`production-status status-${item.status}`}>
              {({ salvo: "Salvo", em_producao: "Em produção", gravado: "Gravado", publicado: "Publicado" })[item.status]}
            </span>
            <strong>{item.products?.nome || "Seu produto salvo"}</strong>
            <span>Continuar →</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
