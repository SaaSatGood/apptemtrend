"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePlatform } from "./store";
import { normalizeScenes } from "@/lib/format";
import ProductImage from "./ProductImage";
import { readGuideProgress } from "./guide-progress";

function nextAction(status: string, kitId: string | null, total: number, recorded: Record<string, number[]>) {
  if (status === "salvo") return "Revisar roteiro";
  if (status === "gravado") return "Publicar vídeo";
  if (status === "em_producao" && kitId && total) {
    const done = recorded[kitId] || [];
    const next = Array.from({ length: total }, (_, index) => index).find((index) => !done.includes(index));
    return next == null ? "Concluir gravação" : `Gravar cena ${next + 1} de ${total}`;
  }
  return "Continuar produção";
}

export default function Opportunities() {
  const { productions } = usePlatform();
  const [recorded, setRecorded] = useState<Record<string, number[]>>({});
  useEffect(() => {
    const progress: Record<string, number[]> = {};
    productions.forEach((item) => { if (item.content_kit_id) progress[item.content_kit_id] = readGuideProgress(item.content_kit_id).scenes; });
    queueMicrotask(() => setRecorded(progress));
  }, [productions]);
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
        <Link className="text-button" href="/app/producao">Ver todos ({productions.length}) →</Link>
      </div>
      <div className="resume-grid">
        {resume.map((item) => (
          <Link
            key={item.id}
            className="resume-card"
            href={item.content_kit_id ? `/app/produtos/${item.product_id}/kits/${item.content_kit_id}` : `/app/produtos/${item.product_id}`}
          >
            <div className="resume-image"><ProductImage product={item.products || { nome: "Produto", imagem_url: null, categoria: null }} width={72} height={72} /></div>
            <div className="resume-content"><span className={`production-status status-${item.status}`}>{({ salvo: "Salvo", em_producao: "Em produção", gravado: "Gravado", publicado: "Publicado" })[item.status]}</span><strong title={item.products?.nome || "Seu produto salvo"}>{item.products?.nome || "Seu produto salvo"}</strong><div className="resume-progress" aria-label={`Etapa ${({ salvo: 1, em_producao: 2, gravado: 3, publicado: 4 })[item.status]} de 4`}><span style={{ width: `${({ salvo: 25, em_producao: 50, gravado: 75, publicado: 100 })[item.status]}%` }} /></div><small>{nextAction(item.status, item.content_kit_id, normalizeScenes(item.content_kits?.cenas).length, recorded)}</small></div>
          </Link>
        ))}
      </div>
    </section>
  );
}
