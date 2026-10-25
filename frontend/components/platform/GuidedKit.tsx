"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import { copyText, fullProductName, normalizeScenes } from "@/lib/format";
import type { ContentKit, CreatorContent, Product } from "@/lib/types";
import { sceneParts } from "./kit-text";
import { directCta, displayKitTitle, finalSceneLine, strategyFrom } from "./kit-presentation";
import { readGuideProgress, saveGuideProgress } from "./guide-progress";
import { track } from "@/lib/track";
import { usePlatform } from "./store";
import Modal from "./Modal";

type Detail = { label: string; text: string };
type GuideStep = { id: string; title: string; label: string; description: string; time?: string; sceneIndex?: number; details: Detail[] };
const PREPARE = ["Produto à mão", "Boa luz", "Fundo organizado", "Lente limpa"];

function shortSceneLabel(value: string, index: number) {
  const clause = value.split(/[,.;:]/)[0].trim();
  return clause.length > 0 && clause.length <= 27 ? `Cena ${index + 1}: ${clause}` : `Cena ${index + 1}`;
}

function pillLabel(step: GuideStep): string {
  if (step.id === "prepare") return "Preparar";
  if (step.id === "hook") return "Abertura";
  if (step.id === "publication") return "Publicar";
  if (step.sceneIndex != null) return `Cena ${step.sceneIndex + 1}`;
  return step.label;
}
function stepsFor(kit: ContentKit, selectedHook: string | null, status: CreatorContent["status"]): GuideStep[] {
  const steps: GuideStep[] = [{ id: "prepare", title: "Antes de gravar", label: "Preparar", description: "Deixe tudo à mão antes de começar. Uma boa base evita regravar depois.", details: [] }];
  if (kit.hook) steps.push({ id: "hook", title: "Abertura", label: "Abertura (hook)", description: "Escolha a abertura que combina com seu vídeo.", details: [{ label: "Fale", text: selectedHook || kit.hook }] });
  const scenes = normalizeScenes(kit.cenas);
  scenes.forEach((scene, index) => {
    const parts = typeof scene === "string" ? { show: scene, say: "", time: "", edit: "" } : sceneParts(scene);
    steps.push({ id: `scene-${index}`, title: `Cena ${String(index + 1).padStart(2, "0")}`, label: shortSceneLabel(parts.show, index), description: `Grave esta cena${parts.time ? ` em ${parts.time}` : ""}.`, time: parts.time, sceneIndex: index, details: [
      ...(parts.show ? [{ label: "Mostre", text: parts.show }] : []),
      ...(parts.say ? [{ label: "Fale", text: finalSceneLine(parts.say, index === scenes.length - 1) }] : []),
      ...(parts.edit ? [{ label: "Ação / edição", text: parts.edit }] : []),
    ] });
  });
  if (!scenes.length && kit.roteiro) steps.push({ id: "script", title: "Siga o roteiro", label: "Roteiro", description: "Adapte as palavras ao seu jeito de falar.", details: [{ label: "Roteiro", text: strategyFrom(kit.roteiro).main || kit.roteiro }] });
  if (status === "gravado" || status === "publicado") steps.push({ id: "publication", title: "Pronto para publicar", label: "Publicação", description: "Copie o material para publicar seu vídeo.", details: [
    { label: "CTA", text: directCta(kit.cta) },
    ...(kit.copy ? [{ label: "Legenda", text: kit.copy }] : []),
    ...(kit.hashtags?.length ? [{ label: "Hashtags", text: kit.hashtags.map((tag) => tag.startsWith("#") ? tag : `#${tag}`).join(" ") }] : []),
    ...(kit.audio_sugerido ? [{ label: "Áudio sugerido", text: kit.audio_sugerido }] : []),
  ] });
  return steps;
}

export default function GuidedKit({ kit, product, status, readyLabel, readyDisabled, statusLabel, onReady, onAllScenesRecorded, onGenerateVariant, onGenerateAnother }: {
  kit: ContentKit; product: Product; status: CreatorContent["status"]; readyLabel: string; readyDisabled?: boolean; statusLabel: string;
  onReady: () => void; onAllScenesRecorded: () => void; onGenerateVariant: (idea: string) => void; onGenerateAnother: () => void;
}) {
  const { toast } = usePlatform();
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedHook, setSelectedHook] = useState<string | null>(null);
  const [recordedScenes, setRecordedScenes] = useState<number[]>([]);
  const [checkedPrep, setCheckedPrep] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [allCopied, setAllCopied] = useState(false);
  const [confirmGenerate, setConfirmGenerate] = useState(false);
  const strategy = useMemo(() => strategyFrom(kit.roteiro), [kit.roteiro]);
  const scenes = normalizeScenes(kit.cenas);
  const steps = stepsFor(kit, selectedHook, status);
  const active = steps[Math.min(activeIndex, steps.length - 1)];
  const atEnd = activeIndex >= steps.length - 1;
  const allRecorded = status === "gravado" || status === "publicado";
  const finishedScenes = allRecorded ? scenes.length : recordedScenes.filter((index) => index < scenes.length).length;
  const hookChoices = [...new Set([kit.hook, ...strategy.hookOptions].filter((item): item is string => Boolean(item)))];
  const activeScene = active.sceneIndex;
  const sceneRecorded = activeScene != null && (allRecorded || recordedScenes.includes(activeScene));
  const stageLabel = active.id === "prepare"
    ? "ANTES DE COMEÇAR"
    : active.id === "hook"
      ? "ABERTURA"
      : active.id === "publication"
        ? "PUBLICAÇÃO"
        : active.id === "script"
          ? "ROTEIRO"
          : "GRAVAÇÃO";
  const primaryLabel = activeScene != null
    ? sceneRecorded
      ? (atEnd ? readyLabel : "Próxima cena")
      : (atEnd ? "Gravei esta cena" : "Gravei, próxima cena")
    : active.id === "prepare"
      ? atEnd ? readyLabel : "Começar a gravar"
      : active.id === "hook" && scenes.length > 0
        ? "Ir para as cenas"
        : atEnd ? readyLabel : "Próxima etapa";
  const primaryDisabled = Boolean(readyDisabled) && atEnd && (activeScene == null || sceneRecorded);
  const headingHint = activeScene != null
    ? sceneRecorded
      ? allRecorded
        ? "Esta cena já está gravada."
        : "Esta cena já está gravada. Siga para a próxima ou desmarque se precisar."
      : "O botão principal marca esta cena como gravada."
    : active.id === "prepare" && scenes.length > 0
      ? "Marque cada cena ao terminar de gravar."
      : active.id === "hook" && scenes.length > 0
        ? "Escolha a abertura e siga para as cenas."
        : active.id === "publication"
          ? "Copie o material e marque o vídeo como publicado."
          : "Siga as etapas do roteiro.";

  useEffect(() => {
    const saved = readGuideProgress(kit.id);
    queueMicrotask(() => {
      setSelectedHook(saved.hook);
      setRecordedScenes(saved.scenes);
      setCheckedPrep(saved.prep.filter((item) => PREPARE.includes(item)));
    });
  }, [kit.id]);
  useEffect(() => { if (status === "gravado" || status === "publicado") queueMicrotask(() => setActiveIndex(steps.length - 1)); }, [status, steps.length]);

  function selectHook(value: string) { const next = value === kit.hook ? null : value; setSelectedHook(next); saveGuideProgress(kit.id, { hook: next, scenes: recordedScenes, prep: checkedPrep }); }
  function togglePrep(item: string) {
    const next = checkedPrep.includes(item) ? checkedPrep.filter((value) => value !== item) : [...checkedPrep, item];
    setCheckedPrep(next);
    saveGuideProgress(kit.id, { hook: selectedHook, scenes: recordedScenes, prep: next });
  }
  function recordScene(index: number) {
    if (allRecorded || recordedScenes.includes(index)) return;
    const next = [...recordedScenes, index];
    track("scene_recorded", { count: next.length });
    setRecordedScenes(next);
    saveGuideProgress(kit.id, { hook: selectedHook, scenes: next, prep: checkedPrep });
    if (scenes.length > 0 && next.length === scenes.length) onAllScenesRecorded();
  }
  function unmarkScene(index: number) {
    if (allRecorded) return;
    const next = recordedScenes.filter((item) => item !== index);
    setRecordedScenes(next);
    saveGuideProgress(kit.id, { hook: selectedHook, scenes: next, prep: checkedPrep });
  }
  function selectStep(index: number) { setActiveIndex(index); setCopied(false); }
  async function copyStep() { const value = active.details.map((item) => `${item.label}: ${item.text}`).join("\n\n") || active.description; if (!(await copyText(value))) { toast("Não conseguimos copiar esta etapa. Tente novamente."); return; } setCopied(true); window.setTimeout(() => setCopied(false), 2200); }
  async function copyPlan() { const lines = steps.filter((step) => step.id !== "prepare").map((step) => [step.title, ...step.details.map((item) => `${item.label}: ${item.text}`)].join("\n")); if (!(await copyText([displayKitTitle(kit, product), ...lines].join("\n\n")))) { toast("Não conseguimos copiar o plano. Tente novamente."); return; } setAllCopied(true); window.setTimeout(() => setAllCopied(false), 2200); }
  async function copyField(item: Detail) { toast(await copyText(item.text) ? `${item.label} copiado ✓` : "Não conseguimos copiar. Tente novamente."); }

  function primaryAction() {
    if (activeScene != null) {
      const alreadyRecorded = allRecorded || recordedScenes.includes(activeScene);
      if (!alreadyRecorded) recordScene(activeScene);
      if (activeIndex < steps.length - 1) { selectStep(activeIndex + 1); return; }
      if (alreadyRecorded) onReady();
      return;
    }
    if (activeIndex < steps.length - 1) selectStep(activeIndex + 1);
    else onReady();
  }

  return <section className="recording-guide" aria-labelledby="recording-guide-title">
    <header className="recording-guide-heading"><div><p className="eyebrow">Guia de gravação</p><h2 id="recording-guide-title">Grave uma etapa de cada vez.</h2><p>{headingHint}<span className="sr-only"> Produto: {fullProductName(product)}.</span></p></div>{scenes.length > 0 && <p className="recording-guide-count"><strong>{finishedScenes}</strong> de {scenes.length} cenas gravadas</p>}</header>
    <label className="recording-guide-mobile-select">Ir para uma etapa<select value={activeIndex} onChange={(event) => selectStep(Number(event.target.value))} aria-label="Escolher etapa do roteiro">{steps.map((step, index) => <option value={index} key={step.id}>{step.label}</option>)}</select></label>
    <div className="recording-guide-grid">
      <div className="recording-guide-stage" key={active.id}>
        <div className="recording-guide-stage-top"><span className="recording-guide-stage-label">{stageLabel}</span>{active.time && <span className="recording-guide-time">{active.time}</span>}</div>
        <div className="recording-guide-instruction" aria-live="polite"><h3>{active.title}</h3><p>{active.description}</p>
          {active.id === "prepare" && <><p className="recording-guide-todo-label">O que fazer</p><div className="recording-guide-prep" aria-label="Preparação para gravar">{PREPARE.map((item) => <button key={item} type="button" className={checkedPrep.includes(item) ? "checked" : ""} aria-pressed={checkedPrep.includes(item)} onClick={() => togglePrep(item)}><span aria-hidden="true">{checkedPrep.includes(item) ? <Icon name="check" size={13} /> : <Icon name="circle" size={13} />}</span>{item}</button>)}</div><p className="recording-guide-tip"><strong>Dica:</strong> Grave perto de uma janela, de frente para a luz. Nunca deixe a luz atrás de você.</p></>}
          {active.details.length > 0 && <div className="recording-guide-details">{active.details.map((item) => <div key={item.label}><strong>{item.label}</strong><p>{item.text}</p>{active.id === "publication" && <button className="recording-guide-field-copy" type="button" onClick={() => void copyField(item)}>Copiar {item.label.toLocaleLowerCase("pt-BR")}</button>}</div>)}</div>}
          {active.id === "hook" && hookChoices.length > 1 && <div className="recording-guide-choices"><strong>Escolha seu hook</strong>{hookChoices.map((option, index) => <div key={`${option}-${index}`} className={(selectedHook || kit.hook) === option ? "selected" : ""}><p>{option}</p><button type="button" onClick={() => selectHook(option)}>{(selectedHook || kit.hook) === option ? "Em uso ✓" : "Usar este hook"}</button></div>)}</div>}
          {active.id !== "prepare" && <button className="recording-guide-copy" type="button" onClick={() => void copyStep()}>{copied ? "Etapa copiada ✓" : "Copiar esta etapa"}</button>}
          <div className="recording-guide-controls"><div className="recording-guide-actions">{activeIndex > 0 && <button className="ghost" type="button" onClick={() => selectStep(activeIndex - 1)}>Voltar</button>}<button className="primary" type="button" disabled={primaryDisabled} onClick={primaryAction}>{primaryLabel}</button></div></div>
          {activeScene != null && sceneRecorded && !allRecorded && <button className="recording-guide-undo" type="button" onClick={() => unmarkScene(activeScene)}>Desmarcar cena gravada</button>}
          {!atEnd && <p className="recording-guide-next">Próxima etapa: {steps[activeIndex + 1].label}</p>}
        </div>
      </div>
      <nav className="recording-guide-steps" aria-label="Etapas do roteiro">
        <div className="recording-guide-plan-heading"><h3>Seu plano</h3></div>
        {steps.map((step, index) => {
          const done = step.sceneIndex != null
            ? allRecorded || recordedScenes.includes(step.sceneIndex)
            : index < activeIndex;
          return <button key={step.id} type="button" title={step.label} className={`${index === activeIndex ? "active" : ""}${done ? " is-done" : ""}`} aria-current={index === activeIndex ? "step" : undefined} onClick={() => selectStep(index)}><span className="recording-guide-step-number" aria-hidden="true">{done ? <Icon name="check" size={11} strokeWidth={2.2} /> : index + 1}</span><span>{pillLabel(step)}<small>{step.time || (done ? "Concluída" : index === activeIndex ? "Etapa atual" : "Pendente")}</small></span></button>;
        })}
      </nav>
    </div>
    <div className="recording-guide-bottom"><div className="recording-guide-support"><span className="recording-guide-status">{statusLabel}</span><button type="button" onClick={() => void copyPlan()}>{allCopied ? "Plano copiado ✓" : "Copiar plano"}</button><Link href="/app/producao">Minha produção</Link><button className="recording-guide-generate" type="button" onClick={() => setConfirmGenerate(true)}>Gerar outra versão <span className="recording-guide-ai-tag">IA</span></button></div>
      {(strategy.main || strategy.faceless || strategy.publishing || strategy.scriptOptions.length > 0 || hookChoices.length > 1) && <details className="recording-guide-more"><summary>Ver roteiro completo <Icon name="chevron-down" size={16} /></summary><div className="recording-guide-more-content">{strategy.main && <section><h3>Roteiro principal</h3><p>{strategy.main}</p></section>}{hookChoices.length > 1 && <section><h3>Variações de hook</h3><div className="recording-guide-variants">{hookChoices.map((option) => <div key={option}><p>{option}</p><button type="button" onClick={() => selectHook(option)}>{(selectedHook || kit.hook) === option ? "Em uso ✓" : "Usar este hook"}</button></div>)}</div></section>}{strategy.scriptOptions.length > 0 && <section><h3>Variações de roteiro</h3><div className="recording-guide-variants">{strategy.scriptOptions.map((option, index) => <div key={`${option}-${index}`}><span>IDEIA {String(index + 1).padStart(2, "0")}</span><p>{option}</p><button type="button" onClick={() => onGenerateVariant(option)}>Usar esta variação</button></div>)}</div></section>}{strategy.faceless && <section><h3>Sem aparecer</h3><p>{strategy.faceless}</p></section>}{strategy.publishing && <section><h3>Dica de publicação</h3><p>{strategy.publishing}</p></section>}</div></details>}
    </div>
    {confirmGenerate && <Modal titleId="generate-variant-title" onClose={() => setConfirmGenerate(false)} className="generate-variant-dialog">
      <form className="stack generate-variant-form" onSubmit={(event) => { event.preventDefault(); setConfirmGenerate(false); onGenerateAnother(); }}>
        <button className="dialog-close" type="button" aria-label="Fechar" onClick={() => setConfirmGenerate(false)}><Icon name="x" size={18} /></button>
        <p className="eyebrow">Nova versão com IA</p>
        <h2 id="generate-variant-title">Gerar outra versão do roteiro?</h2>
        <p className="generate-variant-copy">Essa ação pede uma nova geração de IA e consome <strong>1 roteiro da sua cota mensal</strong>. O roteiro atual continua salvo.</p>
        <div className="generate-variant-actions">
          <button className="ghost" type="button" onClick={() => setConfirmGenerate(false)}>Agora não</button>
          <button className="primary" type="submit">Gerar outra versão</button>
        </div>
        <p className="generate-variant-note">Quer conferir seu uso? <Link href="/app/conta" onClick={() => setConfirmGenerate(false)}>Ver em Minha conta</Link>.</p>
      </form>
    </Modal>}
  </section>;
}
