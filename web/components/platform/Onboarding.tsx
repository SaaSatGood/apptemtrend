"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { api, friendlyError } from "@/lib/api";
import { usePlatform } from "./store";

const OBJECTIVES = [
  ["comecar_vender", "Quero começar a vender"],
  ["vender_mais", "Já vendo e quero vender mais"],
  ["criar_videos", "Quero criar vídeos para produtos"],
  ["explorando", "Estou só explorando"],
];

const STYLES = [
  "Mostrando produtos", "Reviews", "Falando para a câmera", "Unboxing",
  "Tutorial", "Antes e depois", "Outro",
];

const THEMES = ["Beleza", "Casa", "Tecnologia", "Fitness", "Moda", "Lifestyle", "Gastronomia", "Outros"];

interface Saved {
  objetivo: string;
  estilos_conteudo: string[];
  temas_interesse: string[];
  step: number;
}

function loadSaved(): Saved {
  const empty: Saved = { objetivo: "", estilos_conteudo: [], temas_interesse: [], step: 1 };
  try {
    const raw = window.localStorage.getItem("temtrend_onboarding");
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<Saved>;
    return {
      objetivo: typeof parsed.objetivo === "string" ? parsed.objetivo : "",
      estilos_conteudo: Array.isArray(parsed.estilos_conteudo) ? parsed.estilos_conteudo : [],
      temas_interesse: Array.isArray(parsed.temas_interesse) ? parsed.temas_interesse : [],
      step: parsed.step === 2 || parsed.step === 3 ? parsed.step : 1,
    };
  } catch {
    return empty;
  }
}

export default function Onboarding({ editing, onDone }: { editing: boolean; onDone: () => void }) {
  const { toast, reloadMe } = usePlatform();
  const [saved] = useState<Saved>(loadSaved);
  const [step, setStep] = useState(saved.step);
  const [objetivo, setObjetivo] = useState(saved.objetivo);
  const [estilos, setEstilos] = useState<string[]>(saved.estilos_conteudo);
  const [temas, setTemas] = useState<string[]>(saved.temas_interesse);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "temtrend_onboarding",
        JSON.stringify({ objetivo, estilos_conteudo: estilos, temas_interesse: temas, step })
      );
    } catch {
      /* noop */
    }
  }, [objetivo, estilos, temas, step]);

  function toggle(list: string[], value: string, set: (v: string[]) => void) {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  async function advance(skip: boolean) {
    if (step === 1 && !objetivo) return;
    if (step === 2) {
      if (skip) setEstilos([]);
      setStep(3);
      return;
    }
    if (step === 3) {
      const payload = {
        objetivo,
        estilos_conteudo: skip ? [] : estilos,
        temas_interesse: skip ? [] : temas,
      };
      setSaving(true);
      try {
        const { data } = await supabase().auth.getSession();
        await api("/creators/onboarding", data.session?.access_token, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setStep(4);
      } catch (error) {
        toast(friendlyError(error, "Não conseguimos salvar suas preferências. Tente novamente."));
      } finally {
        setSaving(false);
      }
      return;
    }
    if (step === 4) {
      try {
        window.localStorage.removeItem("temtrend_onboarding");
      } catch {
        /* noop */
      }
      await reloadMe();
      onDone();
      return;
    }
    setStep((s) => s + 1);
  }

  function back() {
    if (step === 1 && editing) {
      onDone();
      return;
    }
    setStep((s) => Math.max(1, s - 1));
  }

  const done = step === 4;

  return (
    <section id="onboarding" className="onboarding" aria-labelledby="onboarding-title">
      <Link className="auth-logo onboarding-logo" href="/">
        <span>T</span>TEMTREND
      </Link>
      <div className="onboarding-shell">
        <div className="onboarding-progress" aria-label="Progresso do onboarding">
          <div id="onboarding-progress-bar" style={{ width: `${(Math.min(step, 3) / 3) * 100}%` }}></div>
        </div>
        <p id="onboarding-count" className="step-count">{done ? "Pronto" : `${step} de 3`}</p>
        <div id="onboarding-form">
          <div className={`onboarding-step${step === 1 ? " is-active" : ""}`} data-step="1">
            <div className="onboarding-heading">
              <p className="eyebrow">VAMOS COMEÇAR</p>
              <h1 id="onboarding-title">O que você quer fazer no TikTok?</h1>
              <p>Escolha a opção que mais combina com você agora.</p>
            </div>
            <div className="selection-list single-select" role="radiogroup" aria-label="Seu objetivo">
              {OBJECTIVES.map(([value, label]) => (
                <button
                  key={value}
                  className={`selection-card${objetivo === value ? " selected" : ""}`}
                  type="button"
                  role="radio"
                  aria-checked={objetivo === value}
                  onClick={() => setObjetivo(value)}
                >
                  <span>{label}</span>
                  <i></i>
                </button>
              ))}
            </div>
          </div>

          <div className={`onboarding-step${step === 2 ? " is-active" : ""}`} data-step="2">
            <div className="onboarding-heading">
              <p className="eyebrow">SEU CONTEÚDO</p>
              <h1>O que você gosta de criar?</h1>
              <p>Escolha quantos quiser. Você pode mudar isso depois.</p>
            </div>
            <div className="chip-grid multi-select" aria-label="Tipos de conteúdo">
              {STYLES.map((style) => (
                <button
                  key={style}
                  type="button"
                  aria-pressed={estilos.includes(style)}
                  className={estilos.includes(style) ? "selected" : ""}
                  onClick={() => toggle(estilos, style, setEstilos)}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>

          <div className={`onboarding-step${step === 3 ? " is-active" : ""}`} data-step="3">
            <div className="onboarding-heading">
              <p className="eyebrow">SEUS INTERESSES</p>
              <h1>Quais temas você gosta?</h1>
              <p>Isso ajuda a preparar seu perfil para as próximas oportunidades.</p>
            </div>
            <div className="chip-grid multi-select" aria-label="Temas de interesse">
              {THEMES.map((theme) => (
                <button
                  key={theme}
                  type="button"
                  aria-pressed={temas.includes(theme)}
                  className={temas.includes(theme) ? "selected" : ""}
                  onClick={() => toggle(temas, theme, setTemas)}
                >
                  {theme}
                </button>
              ))}
            </div>
          </div>

          <div className={`onboarding-step onboarding-done${done ? " is-active" : ""}`} data-step="4">
            <span className="done-mark" aria-hidden="true">✓</span>
            <div className="onboarding-heading">
              <p className="eyebrow">TUDO CERTO</p>
              <h1>Pronto.</h1>
              <p>Agora vamos encontrar algo para você vender.</p>
            </div>
          </div>

          <div className="onboarding-actions">
            <button
              id="onboarding-back"
              className={`back-button${(step === 1 && !editing) || done ? " hidden" : ""}`}
              type="button"
              onClick={back}
            >
              {step === 1 ? "Cancelar" : "← Voltar"}
            </button>
            <button
              id="onboarding-skip"
              className={`text-button${step === 1 || done ? " hidden" : ""}`}
              type="button"
              onClick={() => advance(true)}
            >
              Pular por enquanto
            </button>
            <button
              id="onboarding-next"
              className="primary"
              type="button"
              disabled={(step === 1 && !objetivo) || saving}
              onClick={() => advance(false)}
            >
              {saving ? "Preparando..." : done ? "ENCONTRAR PRODUTOS →" : step === 3 ? "Começar →" : "Continuar →"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
