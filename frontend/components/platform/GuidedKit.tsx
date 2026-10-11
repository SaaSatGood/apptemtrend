"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { copyText, displayProductName, FALLBACK_IMAGE, normalizeScenes } from "@/lib/format";
import type { ContentKit, Product } from "@/lib/types";
import { sceneParts } from "./kit-text";
import { directCta, finalSceneLine, strategyFrom } from "./kit-presentation";
import { usePlatform } from "./store";

type GuideStep = {
  id: string;
  title: string;
  label: string;
  description: string;
  time?: string;
  details: Array<{ label: string; text: string }>;
};

const PREPARE = ["Produto à mão", "Boa luz", "Fundo organizado", "Lente limpa"];

function stepsFor(kit: ContentKit, selectedHook: string | null): GuideStep[] {
  const steps: GuideStep[] = [{
    id: "prepare", title: "Antes de gravar", label: "Prepare a gravação",
    description: "Deixe o espaço pronto para gravar sem interrupções.", details: [],
  }];
  if (kit.hook) steps.push({
    id: "hook", title: "Abra com o hook", label: "Abertura",
    description: "Escolha uma frase e fale no seu jeito para prender a atenção logo no início.",
    details: [{ label: "Fale", text: selectedHook || kit.hook }],
  });
  const scenes = normalizeScenes(kit.cenas);
  scenes.forEach((scene, index) => {
    const parts = typeof scene === "string" ? { show: scene, say: "", time: "", edit: "" } : sceneParts(scene);
    steps.push({
      id: `scene-${index}`, title: `Cena ${String(index + 1).padStart(2, "0")}`,
      label: parts.show || `Cena ${String(index + 1).padStart(2, "0")}`,
      description: "Grave este trecho e avance quando estiver pronto.", time: parts.time,
      details: [
        ...(parts.show ? [{ label: "Mostre", text: parts.show }] : []),
        ...(parts.say ? [{ label: "Fale", text: finalSceneLine(parts.say, index === scenes.length - 1) }] : []),
        ...(parts.edit ? [{ label: "Ação / edição", text: parts.edit }] : []),
      ],
    });
  });
  if (kit.cta || kit.copy || kit.hashtags?.length) steps.push({
    id: "finish", title: "Feche o vídeo", label: "Fechamento",
    description: "Termine com uma chamada clara e use a legenda na publicação.",
    details: [
      { label: "Chamada para ação", text: directCta(kit.cta) },
      ...(kit.copy ? [{ label: "Legenda", text: kit.copy }] : []),
      ...(kit.hashtags?.length ? [{ label: "Hashtags", text: kit.hashtags.map((tag) => tag.startsWith("#") ? tag : `#${tag}`).join(" ") }] : []),
    ],
  });
  if (steps.length === 1 && kit.roteiro) steps.push({
    id: "script", title: "Siga o roteiro", label: "Roteiro",
    description: "Use este texto como apoio e adapte as palavras ao seu jeito de falar.",
    details: [{ label: "Roteiro", text: strategyFrom(kit.roteiro).main || kit.roteiro }],
  });
  return steps;
}

export default function GuidedKit({ kit, product, readyLabel, readyDisabled, statusLabel, onReady, onGenerateVariant, onGenerateAnother }: {
  kit: ContentKit;
  product: Product;
  readyLabel: string;
  readyDisabled?: boolean;
  statusLabel: string;
  onReady: () => void;
  onGenerateVariant: (idea: string) => void;
  onGenerateAnother: () => void;
}) {
  const { toast } = usePlatform();
  const [activeIndex, setActiveIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [allCopied, setAllCopied] = useState(false);
  const [selectedHook, setSelectedHook] = useState<string | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const strategy = strategyFrom(kit.roteiro);
  const steps = stepsFor(kit, selectedHook);
  const active = steps[activeIndex] || steps[0];
  const atEnd = activeIndex === steps.length - 1;
  const copy = active.details.map((item) => `${item.label}: ${item.text}`).join("\n\n") || active.description;

  async function copyStep() {
    if (!(await copyText(copy))) { toast("Não conseguimos copiar esta etapa. Tente novamente."); return; }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  }
  async function copyPlan() {
    const lines = steps.filter((step) => step.id !== "prepare").map((step) => [step.title, ...step.details.map((item) => `${item.label}: ${item.text}`)].join("\n"));
    if (!(await copyText([kit.titulo, ...lines].join("\n\n")))) { toast("Não conseguimos copiar o plano. Tente novamente."); return; }
    setAllCopied(true);
    window.setTimeout(() => setAllCopied(false), 2200);
  }
  function selectStep(index: number) { setActiveIndex(index); setCopied(false); }

  return (
    <section className="recording-guide" aria-labelledby="recording-guide-title">
      <header className="recording-guide-heading">
        <div><p className="eyebrow">Guia de gravação</p><h2 id="recording-guide-title">Grave uma etapa de cada vez.</h2><p>O roteiro foi organizado em ações curtas para você usar enquanto grava.</p></div>
        <span className="recording-guide-counter">{String(activeIndex + 1).padStart(2, "0")} <small>/ {String(steps.length).padStart(2, "0")}</small></span>
      </header>
      <div className="recording-guide-grid">
        <div className="recording-guide-stage" key={active.id}>
          <div className="recording-guide-stage-top"><span className="recording-guide-stage-label">{active.id === "prepare" ? "ANTES DE COMEÇAR" : `PASSO ${String(activeIndex + 1).padStart(2, "0")}`}</span>{active.time && <span className="recording-guide-time">{active.time}</span>}</div>
          <div className="recording-guide-instruction" aria-live="polite">
            <h3>{active.title}</h3><p>{active.description}</p>
            {active.id === "prepare" && <div className="recording-guide-prep" aria-label="Preparação para gravar">{PREPARE.map((item) => <button key={item} type="button" className={checked.includes(item) ? "checked" : ""} aria-pressed={checked.includes(item)} onClick={() => setChecked((items) => items.includes(item) ? items.filter((value) => value !== item) : [...items, item])}><span aria-hidden="true">{checked.includes(item) ? "✓" : "○"}</span>{item}</button>)}</div>}
            {active.details.length > 0 && <div className="recording-guide-details">{active.details.map((item) => <div key={item.label}><strong>{item.label}</strong><p>{item.text}</p></div>)}</div>}
            {active.id === "hook" && strategy.hookOptions.length > 0 && <div className="recording-guide-choices"><strong>Outras aberturas</strong>{strategy.hookOptions.map((option, index) => <div key={`${option}-${index}`} className={selectedHook === option ? "selected" : ""}><p>{option}</p><button type="button" onClick={() => setSelectedHook(option)}>{selectedHook === option ? "Em uso ✓" : "Usar este hook"}</button></div>)}{selectedHook && <button className="recording-guide-original" type="button" onClick={() => setSelectedHook(null)}>Voltar ao hook original</button>}</div>}
          </div>
          <div className="recording-guide-product"><div className="recording-guide-image"><Image src={product.imagem_url || FALLBACK_IMAGE} alt={displayProductName(product)} width={280} height={230} unoptimized onError={(event) => { (event.target as HTMLImageElement).src = FALLBACK_IMAGE; }} /></div><div><span>PRODUTO DO VÍDEO</span><strong>{displayProductName(product)}</strong></div></div>
        </div>
        <div className="recording-guide-navigation">
          <div className="recording-guide-progress-heading"><strong>Seu plano</strong><span>{activeIndex + 1} de {steps.length} etapas</span></div>
          <div className="recording-guide-progress" role="progressbar" aria-label="Progresso do guia" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={activeIndex + 1}><span style={{ width: `${((activeIndex + 1) / steps.length) * 100}%` }} /></div>
          <nav className="recording-guide-steps" aria-label="Etapas do roteiro">{steps.map((step, index) => <button key={step.id} type="button" className={index === activeIndex ? "active" : ""} aria-current={index === activeIndex ? "step" : undefined} onClick={() => selectStep(index)}><span className="recording-guide-step-number">{index < activeIndex ? "✓" : index + 1}</span><span className="recording-guide-step-copy"><strong>{step.label}</strong><small>{step.title}{step.time ? ` · ${step.time}` : ""}</small></span><span className="recording-guide-step-arrow" aria-hidden="true">→</span></button>)}</nav>
          <div className="recording-guide-controls"><button className="recording-guide-copy" type="button" onClick={() => void copyStep()}>{copied ? "Etapa copiada ✓" : "Copiar esta etapa"}</button><div className="recording-guide-actions">{activeIndex > 0 && <button className="ghost" type="button" onClick={() => selectStep(activeIndex - 1)}>Voltar</button>}<button className="primary" type="button" disabled={atEnd && readyDisabled} onClick={() => atEnd ? onReady() : selectStep(activeIndex + 1)}>{atEnd ? readyLabel : activeIndex === 0 ? "Estou pronto →" : "Próxima etapa →"}</button></div></div>
        </div>
      </div>
      <div className="recording-guide-bottom">
        <div className="recording-guide-support"><span className="recording-guide-status">{statusLabel}</span><button type="button" onClick={() => void copyPlan()}>{allCopied ? "Plano copiado ✓" : "Copiar plano"}</button><button type="button" onClick={onGenerateAnother}>Gerar outra versão</button><Link href="/app/producao">Minha produção →</Link></div>
        {(strategy.main || strategy.faceless || strategy.publishing || strategy.scriptOptions.length > 0) && <details className="recording-guide-more"><summary>Ver roteiro completo <span aria-hidden="true">⌄</span></summary><div className="recording-guide-more-content">{strategy.main && <section><h3>Roteiro principal</h3><p>{strategy.main}</p></section>}{strategy.faceless && <section><h3>Se não quiser aparecer</h3><p>{strategy.faceless}</p></section>}{strategy.publishing && <section><h3>Dica de publicação</h3><p>{strategy.publishing}</p></section>}{strategy.scriptOptions.length > 0 && <section><h3>Outras abordagens</h3><div className="recording-guide-variants">{strategy.scriptOptions.map((option, index) => <div key={`${option}-${index}`}><span>IDEIA {String(index + 1).padStart(2, "0")}</span><p>{option}</p><button type="button" onClick={() => onGenerateVariant(option)}>Gerar com esta ideia →</button></div>)}</div></section>}</div></details>}
      </div>
    </section>
  );
}
