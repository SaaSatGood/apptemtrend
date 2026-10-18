"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { api, friendlyError } from "@/lib/api";
import { track } from "@/lib/track";
import { usePlatform } from "./store";

const OBJECTIVES = [
  { value: "comecar_vender", label: "Quero começar a vender", detail: "Encontre um produto e dê o primeiro passo.", icon: "●" },
  { value: "vender_mais", label: "Já vendo e quero vender mais", detail: "Crie novas ideias para o seu catálogo.", icon: "✦" },
  { value: "criar_videos", label: "Quero criar vídeos para produtos", detail: "Transforme produtos em roteiros graváveis.", icon: "▣" },
  { value: "explorando", label: "Estou só explorando", detail: "Conheça a plataforma no seu ritmo.", icon: "◎" },
] as const;

const STYLES = [
  "Mostrando produtos", "Reviews", "Falando para a câmera", "Unboxing",
  "Tutorial", "Antes e depois", "Outro",
];

const THEMES = ["Beleza", "Casa", "Tecnologia", "Fitness", "Moda", "Lifestyle", "Gastronomia", "Outros"];

const STEP_LABELS = ["Objetivo", "Estilos", "Temas", "Sua voz", "Pronto"];

const VOZ_MAX = 500;

// Rascunho local do onboarding por usuário: permite retomar de onde parou
// sem tocar no backend antes do POST final em /creators/onboarding.
const DRAFT_PREFIX = "temtrend_onboarding";

type OnboardingDraft = {
  step: number;
  objetivo: string;
  estilos: string[];
  temas: string[];
  voz: string;
  updatedAt: string;
};

function draftKey(userId: string | undefined): string {
  return userId ? `${DRAFT_PREFIX}:${userId}` : DRAFT_PREFIX;
}

function readDraft(userId: string | undefined): OnboardingDraft | null {
  try {
    const raw = window.localStorage.getItem(draftKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OnboardingDraft>;
    if (!parsed || typeof parsed.step !== "number") return null;
    return {
      step: Math.min(Math.max(1, Math.round(parsed.step)), 5),
      objetivo: typeof parsed.objetivo === "string" ? parsed.objetivo : "",
      estilos: Array.isArray(parsed.estilos) ? parsed.estilos.filter((v): v is string => typeof v === "string") : [],
      temas: Array.isArray(parsed.temas) ? parsed.temas.filter((v): v is string => typeof v === "string") : [],
      voz: typeof parsed.voz === "string" ? parsed.voz.slice(0, VOZ_MAX) : "",
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export default function Onboarding({ editing, onDone }: { editing: boolean; onDone: () => void }) {
  const { toast, reloadMe, me } = usePlatform();
  // O progresso intermediário é salvo em localStorage (por usuário) e
  // retomado ao voltar. O backend só recebe o POST final em
  // /creators/onboarding. Entrar com conta já cadastrada cai direto no app
  // quando me.onboarding_completo é true.
  const [step, setStep] = useState(1);
  const [objetivo, setObjetivo] = useState(me?.creator?.objetivo || "");
  const [estilos, setEstilos] = useState<string[]>(me?.creator?.estilos_conteudo || []);
  const [temas, setTemas] = useState<string[]>(me?.creator?.temas_interesse || []);
  const [voz, setVoz] = useState(me?.creator?.voz_exemplo || "");
  const [saving, setSaving] = useState(false);
  const restoredRef = useRef(false);

  // Retoma o rascunho salvo (uma vez) quando o usuário volta no meio do fluxo.
  // Precisa rodar pós-montagem: localStorage não existe no SSR e a hidratação
  // deve ver a etapa 1 para bater com o HTML do servidor.
  /* eslint-disable react-hooks/set-state-in-effect -- restauração única de rascunho local pós-hidratação */
  useEffect(() => {
    if (editing || restoredRef.current || !me?.user_id) return;
    restoredRef.current = true;
    const draft = readDraft(me.user_id);
    if (!draft || draft.step <= 1) return;
    setStep(draft.step);
    setObjetivo((current) => current || draft.objetivo);
    setEstilos((current) => (current.length ? current : draft.estilos));
    setTemas((current) => (current.length ? current : draft.temas));
    setVoz((current) => current || draft.voz);
    toast("Retomamos de onde você parou.");
  }, [editing, me?.user_id, toast]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Salva o rascunho a cada mudança relevante; some quando o fluxo conclui.
  useEffect(() => {
    if (editing || !me?.user_id || step >= 5) return;
    const draft: OnboardingDraft = { step, objetivo, estilos, temas, voz, updatedAt: new Date().toISOString() };
    try {
      window.localStorage.setItem(draftKey(me.user_id), JSON.stringify(draft));
    } catch {
      /* armazenamento indisponível: segue sem rascunho */
    }
  }, [editing, me?.user_id, step, objetivo, estilos, temas, voz]);

  function clearStaleDraft() {
    // Limpa o rascunho local depois de concluir (ou ao sair da edição).
    try {
      window.localStorage.removeItem("temtrend_onboarding");
      if (me?.user_id) window.localStorage.removeItem(`temtrend_onboarding:${me.user_id}`);
    } catch {
      /* noop */
    }
  }

  function toggle(list: string[], value: string, set: (v: string[]) => void) {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  async function advance(skip: boolean) {
    if (saving) return;
    if (step === 1 && !objetivo) return;
    track("onboarding_step", { step, skip: skip ? 1 : 0 });
    if (step === 2) {
      if (skip && !editing) setEstilos([]);
      setStep(3);
      return;
    }
    if (step === 3) {
      if (skip && !editing) setTemas([]);
      setStep(4);
      return;
    }
    if (step === 4) {
      if (skip && !editing) setVoz("");
      const payload = {
        objetivo,
        estilos_conteudo: estilos,
        temas_interesse: temas,
        voz_exemplo: skip && !editing ? "" : voz.trim(),
      };
      setSaving(true);
      try {
        const { data } = await supabase().auth.getSession();
        await api("/creators/onboarding", data.session?.access_token, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        track("onboarding_completed");
        setStep(5);
      } catch (error) {
        toast(friendlyError(error, "Não conseguimos salvar suas preferências. Tente novamente."));
      } finally {
        setSaving(false);
      }
      return;
    }
    if (step === 5) {
      clearStaleDraft();
      setSaving(true);
      try { await reloadMe(); onDone(); }
      catch (error) { toast(friendlyError(error, "Suas preferências foram salvas. Tente continuar novamente.")); }
      finally { setSaving(false); }
      return;
    }
    setStep((s) => s + 1);
  }

  function back() {
    if (step === 1 && editing) {
      clearStaleDraft();
      onDone();
      return;
    }
    setStep((s) => Math.max(1, s - 1));
  }

  const done = step === 5;
  const selectedObjective = OBJECTIVES.find((item) => item.value === objetivo);
  const suggestedTheme = temas[0];

  return (
    <section id="onboarding" className={`onboarding${editing ? " onboarding--editing" : ""}`} aria-label={editing ? "Editar preferências" : "Configurar seu perfil"}>
      {!editing && (
        <header className="onboarding-topbar">
          <Link className="auth-logo onboarding-logo" href="/" aria-label="TemTrend, página inicial">
            <span aria-hidden="true">T</span><b>TemTrend</b>
          </Link>
          <span>Seu espaço começa aqui</span>
        </header>
      )}
      <div className="onboarding-layout">
        <aside className="onboarding-aside" aria-label="Sobre a configuração">
          <div>
            <p className="eyebrow">{editing ? "Suas preferências" : "Boas-vindas à TemTrend"}</p>
            <h2>{editing ? <>Seu conteúdo, <em>do seu jeito.</em></> : <>Vamos dar direção às <em>suas ideias.</em></>}</h2>
            <p>{editing ? "Atualize o que você gosta de criar. As próximas sugestões acompanham suas escolhas." : "Conte um pouco sobre você para começar com sugestões de produtos e ideias de vídeo que fazem sentido."}</p>
          </div>
          <div className="onboarding-aside-note">
            <span aria-hidden="true">✳</span>
            <p><strong>Da descoberta à gravação.</strong> Escolha um produto, encontre um caminho e crie com confiança.</p>
          </div>
        </aside>
        <div className="onboarding-shell">
          <div className="onboarding-card-head">
            <span>{editing ? "Ajustar perfil" : "Configuração inicial"}</span>
            <span>{String(step).padStart(2, "0")} / 05</span>
          </div>
          <ol className="onboarding-stepper" aria-label="Etapas da configuração">
            {STEP_LABELS.map((label, index) => {
              const number = index + 1;
              return (
                <li key={label} className={number === step ? "is-current" : number < step ? "is-complete" : ""} aria-current={number === step ? "step" : undefined}>
                  <span>{number < step ? "✓" : number}</span>{label}
                </li>
              );
            })}
          </ol>
        <div className="onboarding-progress" role="progressbar" aria-label="Progresso do onboarding" aria-valuenow={step} aria-valuemin={0} aria-valuemax={5}>
          <div id="onboarding-progress-bar" style={{ width: `${(Math.min(step, 5) / 5) * 100}%` }}></div>
        </div>
        <div className="onboarding-meta">
          <p id="onboarding-count" className="step-count">{done ? "Perfil configurado" : `Etapa ${step} de 5`}</p>
          {!done && <p>Leva menos de 1 minuto</p>}
        </div>
        <div id="onboarding-form">
          <div className={`onboarding-step${step === 1 ? " is-active" : ""}`} data-step="1">
            <div className="onboarding-heading">
              <p className="eyebrow">Vamos começar</p>
              <h1 id="onboarding-title">O que você quer fazer no TikTok?</h1>
              <p>Escolha a opção que mais combina com você agora.</p>
            </div>
            <div className="selection-list single-select" role="radiogroup" aria-label="Seu objetivo">
              {OBJECTIVES.map(({ value, label, detail, icon }) => (
                <button
                  key={value}
                  className={`selection-card${objetivo === value ? " selected" : ""}`}
                  type="button"
                  role="radio"
                  aria-checked={objetivo === value}
                  onClick={() => setObjetivo(value)}
                >
                  <span className="selection-icon" aria-hidden="true">{icon}</span>
                  <span className="selection-copy"><strong>{label}</strong><small>{detail}</small></span>
                  <i></i>
                </button>
              ))}
            </div>
            <p className="onboarding-tip">Sua escolha ajuda a organizar as sugestões. Você pode mudar isso na sua conta.</p>
          </div>

          <div className={`onboarding-step${step === 2 ? " is-active" : ""}`} data-step="2">
            <div className="onboarding-heading">
              <p className="eyebrow">Seu conteúdo</p>
              <h1>O que você gosta de criar?</h1>
              <p>Escolha quantos quiser. Você pode mudar isso depois.</p>
            </div>
            <p className="selection-feedback" aria-live="polite">{estilos.length ? `${estilos.length} selecionado${estilos.length > 1 ? "s" : ""}` : "Nenhuma seleção obrigatória"}</p>
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
            <p className="onboarding-tip">Escolha os formatos que parecem mais naturais para você. Não precisa dominar nenhum deles agora.</p>
          </div>

          <div className={`onboarding-step${step === 3 ? " is-active" : ""}`} data-step="3">
            <div className="onboarding-heading">
              <p className="eyebrow">Seus interesses</p>
              <h1>Quais temas você gosta?</h1>
              <p>Isso ajuda a preparar seu perfil para as próximas oportunidades.</p>
            </div>
            <p className="selection-feedback" aria-live="polite">{temas.length ? `${temas.length} selecionado${temas.length > 1 ? "s" : ""}` : "Nenhuma seleção obrigatória"}</p>
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
            <p className="onboarding-tip">Seus temas aparecerão como atalhos de busca na área Descobrir.</p>
          </div>

          <div className={`onboarding-step${step === 4 ? " is-active" : ""}`} data-step="4">
            <div className="onboarding-heading">
              <p className="eyebrow">Sua voz</p>
              <h1>Como você fala nos vídeos?</h1>
              <p>Escreva 2 ou 3 frases do seu jeito. Usamos isso para o roteiro parecer seu. Você também pode pular.</p>
            </div>
            <label className="voice-field">
              <span className="sr-only">Exemplo do seu jeito de falar</span>
              <textarea
                rows={4}
                maxLength={VOZ_MAX}
                placeholder="Ex.: Gente, preciso mostrar isso pra vocês. Testei por uma semana e olha no que deu..."
                value={voz}
                onChange={(e) => setVoz(e.target.value)}
              />
            </label>
            <p className="selection-feedback" aria-live="polite">{voz.trim() ? `${voz.trim().length} de ${VOZ_MAX} caracteres` : "Opcional. Os roteiros funcionam sem isso"}</p>
            <p className="onboarding-tip">Vale gíria, vale bordão. Evite contar sua vida: o que importa é o tom.</p>
          </div>

          <div className={`onboarding-step onboarding-done${done ? " is-active" : ""}`} data-step="5">
            <span className="done-mark" aria-hidden="true">✓</span>
            <div className="onboarding-heading">
              <p className="eyebrow">Tudo certo</p>
              <h1>Pronto.</h1>
              <p>Seu perfil está preparado. Agora vamos encontrar um produto real e transformar os dados dele em um plano para gravar.</p>
            </div>
            <div className="onboarding-summary">
              {selectedObjective && <span className="onboarding-summary-goal">{selectedObjective.label}<small>seu objetivo</small></span>}
              <span>{estilos.length || 0}<small>formatos escolhidos</small></span>
              <span>{temas.length || 0}<small>temas de interesse</small></span>
              {voz.trim() && <span>Roteiros no seu jeito ✓<small>sua voz</small></span>}
            </div>
            {suggestedTheme && !editing && (
              <p className="onboarding-next-tip">Na próxima tela, experimente buscar produtos de {suggestedTheme.toLocaleLowerCase("pt-BR")}.</p>
            )}
          </div>

          <div className="onboarding-actions">
            <button
              id="onboarding-back"
              className={`back-button${(step === 1 && !editing) || done ? " hidden" : ""}`}
              type="button"
              onClick={back} disabled={saving}
            >
              {step === 1 ? "Cancelar" : "Voltar"}
            </button>
            <button
              id="onboarding-skip"
              className={`text-button${step === 1 || done ? " hidden" : ""}`}
              type="button"
              onClick={() => advance(true)} disabled={saving}
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
              {saving ? "Salvando preferências..." : done ? editing ? "Voltar à conta" : "Ir para Descobrir" : step === 4 ? "Concluir configuração" : "Continuar"}
            </button>
          </div>
        </div>
        </div>
      </div>
    </section>
  );
}
