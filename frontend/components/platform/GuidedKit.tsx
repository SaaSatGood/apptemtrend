"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { copyText, displayProductName, FALLBACK_IMAGE, normalizeScenes } from "@/lib/format";
import type { ContentKit, Product } from "@/lib/types";
import { sceneParts } from "./kit-text";
import { usePlatform } from "./store";

type GuideStep = {
  id: string;
  title: string;
  label: string;
  description: string;
  time?: string;
  details: Array<{ label: string; text: string }>;
};

function stepsFor(kit: ContentKit): GuideStep[] {
  const steps: GuideStep[] = [{
    id: "prepare",
    title: "Antes de gravar",
    label: "Prepare a gravação",
    description: "Separe o produto, escolha um lugar com boa luz e deixe o celular pronto. Leia o plano antes de começar.",
    details: [
      ...(kit.briefing_usuario ? [{ label: "Seu briefing", text: kit.briefing_usuario }] : []),
      ...(kit.descricao ? [{ label: "Ideia do vídeo", text: kit.descricao }] : []),
    ],
  }];

  if (kit.hook) steps.push({
    id: "hook",
    title: "Abra com o hook",
    label: "Abertura",
    description: "Comece com a frase que apresenta a ideia do vídeo. Fale do seu jeito, mantendo a mensagem principal.",
    details: [{ label: "Fale", text: kit.hook }],
  });

  normalizeScenes(kit.cenas).forEach((scene, index) => {
    const parts = typeof scene === "string" ? { show: scene, say: "", time: "", edit: "" } : sceneParts(scene);
    steps.push({
      id: `scene-${index}`,
      title: `Cena ${String(index + 1).padStart(2, "0")}`,
      label: parts.show || `Cena ${String(index + 1).padStart(2, "0")}`,
      description: "Grave este trecho e avance quando estiver pronto.",
      time: parts.time,
      details: [
        ...(parts.show ? [{ label: "Mostre", text: parts.show }] : []),
        ...(parts.say ? [{ label: "Fale", text: parts.say }] : []),
        ...(parts.edit ? [{ label: "Ação / edição", text: parts.edit }] : []),
      ],
    });
  });

  if (kit.cta || kit.copy) steps.push({
    id: "finish",
    title: "Feche o vídeo",
    label: "Fechamento",
    description: "Termine com uma chamada clara. A legenda fica pronta para usar quando você publicar.",
    details: [
      ...(kit.cta ? [{ label: "Chamada para ação", text: kit.cta }] : []),
      ...(kit.copy ? [{ label: "Legenda", text: kit.copy }] : []),
    ],
  });

  if (steps.length === 1 && kit.roteiro) steps.push({
    id: "script",
    title: "Siga o roteiro",
    label: "Roteiro",
    description: "Use este texto como apoio e adapte as palavras ao seu jeito de falar.",
    details: [{ label: "Roteiro", text: kit.roteiro }],
  });

  return steps;
}

export default function GuidedKit({
  kit,
  product,
  onReady,
  readyLabel,
}: {
  kit: ContentKit;
  product: Product;
  onReady: () => void;
  readyLabel: string;
}) {
  const { toast } = usePlatform();
  const [activeIndex, setActiveIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [reading, setReading] = useState(false);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);
  const steps = stepsFor(kit);
  const active = steps[activeIndex] || steps[0];
  const atEnd = activeIndex === steps.length - 1;
  const copy = active.details.map((item) => `${item.label}: ${item.text}`).join("\n\n") || active.description;

  useEffect(() => {
    return () => { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); };
  }, []);

  function stopReading() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    speechRef.current = null;
    setReading(false);
  }

  function toggleReading() {
    if (reading) { stopReading(); return; }
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      toast("A leitura em voz alta não está disponível neste dispositivo.");
      return;
    }
    const utterance = new SpeechSynthesisUtterance(`${active.title}. ${active.description}. ${copy}`);
    utterance.lang = "pt-BR";
    utterance.rate = 0.95;
    utterance.onend = () => { if (speechRef.current === utterance) { speechRef.current = null; setReading(false); } };
    utterance.onerror = utterance.onend;
    speechRef.current = utterance;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setReading(true);
  }

  async function copyStep() {
    if (!(await copyText(copy))) {
      toast("Não conseguimos copiar esta etapa. Tente novamente.");
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  }

  function selectStep(index: number) {
    stopReading();
    setActiveIndex(index);
    setCopied(false);
  }

  return (
    <section className="recording-guide" aria-labelledby="recording-guide-title">
      <header className="recording-guide-heading">
        <div>
          <p className="eyebrow">Guia de gravação</p>
          <h2 id="recording-guide-title">Grave uma etapa de cada vez.</h2>
          <p>O roteiro foi organizado em ações curtas para você usar enquanto grava.</p>
        </div>
        <span className="recording-guide-counter">{String(activeIndex + 1).padStart(2, "0")} <small>/ {String(steps.length).padStart(2, "0")}</small></span>
      </header>

      <div className="recording-guide-grid">
        <div className="recording-guide-stage" key={active.id}>
          <div className="recording-guide-stage-top">
            <span className="recording-guide-stage-label">{active.id === "prepare" ? "ANTES DE COMEÇAR" : `PASSO ${String(activeIndex + 1).padStart(2, "0")}`}</span>
            {active.time && <span className="recording-guide-time">{active.time}</span>}
          </div>
          <div className="recording-guide-instruction" aria-live="polite">
            <h3>{active.title}</h3>
            <p>{active.description}</p>
            {active.details.length > 0 && (
              <div className="recording-guide-details">
                {active.details.map((item) => (
                  <div key={item.label}>
                    <strong>{item.label}</strong>
                    <p>{item.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="recording-guide-product">
            <div className="recording-guide-image">
              <Image src={product.imagem_url || FALLBACK_IMAGE} alt={displayProductName(product)} width={280} height={230} unoptimized onError={(event) => { (event.target as HTMLImageElement).src = FALLBACK_IMAGE; }} />
            </div>
            <div><span>PRODUTO DO VÍDEO</span><strong>{displayProductName(product)}</strong></div>
          </div>
        </div>

        <div className="recording-guide-navigation">
          <div className="recording-guide-progress-heading"><strong>Seu plano</strong><span>{activeIndex + 1} de {steps.length} etapas</span></div>
          <div className="recording-guide-progress" role="progressbar" aria-label="Progresso do guia" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={activeIndex + 1}><span style={{ width: `${((activeIndex + 1) / steps.length) * 100}%` }} /></div>
          <nav className="recording-guide-steps" aria-label="Etapas do roteiro">
            {steps.map((step, index) => (
              <button key={step.id} type="button" className={index === activeIndex ? "active" : ""} aria-current={index === activeIndex ? "step" : undefined} onClick={() => selectStep(index)}>
                <span className="recording-guide-step-number">{index < activeIndex ? "✓" : index + 1}</span>
                <span className="recording-guide-step-copy"><strong>{step.label}</strong><small>{step.title}{step.time ? ` · ${step.time}` : ""}</small></span>
                <span className="recording-guide-step-arrow" aria-hidden="true">→</span>
              </button>
            ))}
          </nav>
          <div className="recording-guide-controls">
            <div className="recording-guide-audio"><button type="button" aria-label={reading ? "Parar leitura da etapa" : "Ouvir etapa"} onClick={toggleReading}>{reading ? "■" : "▶"}</button><div><strong>{reading ? "Lendo esta etapa" : "Ouvir esta etapa"}</strong><small>Voz do seu dispositivo</small></div></div>
            <button className="recording-guide-copy" type="button" onClick={() => void copyStep()}>{copied ? "Etapa copiada ✓" : "Copiar esta etapa"}</button>
            <div className="recording-guide-actions">
              {activeIndex > 0 && <button className="ghost" type="button" onClick={() => selectStep(activeIndex - 1)}>Voltar</button>}
              <button className="primary" type="button" onClick={() => { if (atEnd) { stopReading(); onReady(); } else selectStep(activeIndex + 1); }}>{atEnd ? readyLabel : activeIndex === 0 ? "Estou pronto →" : "Próxima etapa →"}</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
