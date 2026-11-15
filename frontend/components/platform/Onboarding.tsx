"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import Modal from "./Modal";
import TemtrendArt from "./TemtrendArt";
import { resolveSession } from "@/lib/supabase";
import { api, friendlyError } from "@/lib/api";
import { track } from "@/lib/track";
import { hasPaidPlan } from "@/lib/plan-access";
import { planBullets } from "@/lib/billing-catalog";
import {
  EXTRA_THEMES,
  NICHO_MAX,
  OBJECTIVES,
  OTHER_THEME,
  STYLES,
  THEMES,
  THEMES_MAX,
  splitSavedThemes,
  stylesPayload,
  themeLabel,
  themesPayload,
} from "@/lib/creator-preferences";
import { usePlatform } from "./store";
import type { BillingCatalogResponse } from "@/lib/types";

const STEP_LABELS = ["Objetivo", "Interesses", "Plano"];

const STEP_COPY = [
  {
    kicker: "Boas-vindas à TemTrend",
    title: <>Comece a vender com <em>direção.</em></>,
    description: "Um objetivo claro muda as sugestões, os roteiros e o próximo passo.",
    hint: "Onde você quer chegar",
  },
  {
    kicker: "Seu nicho, seu roteiro",
    title: <>O que você vende define o seu <em>conteúdo.</em></>,
    description: "Escolha seus temas e formatos. A TemTrend usa isso para encontrar produtos e escrever no seu jeito de gravar.",
    hint: "O que interessa vender",
  },
  {
    kicker: "Seu plano",
    title: <>Comece a postar com <em>constância.</em></>,
    description: "Um plano só, com tudo para a pauta de hoje, a semana organizada e o roteiro pronto.",
    hint: "Grátis ou Pro, você decide",
  },
  {
    kicker: "Tudo pronto",
    title: <>Seu espaço está <em>preparado.</em></>,
    description: "Agora vamos encontrar produtos reais e transformar ideias em vídeos.",
    hint: "Seu primeiro produto",
  },
];

const DONE_BY_OBJECTIVE: Record<string, string> = {
  comecar_vender: "Vamos começar pelo catálogo, com produtos reais e comissão à vista.",
  vender_mais: "Seu próximo passo é encontrar novas oportunidades para o catálogo.",
  criar_videos: "Escolha um produto e transforme a ideia em um roteiro gravável.",
  explorando: "Sem pressa: veja produtos reais e entenda como a TemTrend funciona.",
};

type Step = 1 | 2 | 3 | 4;
type Period = "monthly" | "annual";

// Rascunho local por usuário: retoma objetivo, temas, nicho e formatos sem
// tocar no backend antes do POST final em /creators/onboarding.
const DRAFT_PREFIX = "temtrend_onboarding";

type OnboardingDraft = {
  step: number;
  objetivo: string;
  estilos: string[];
  temas: string[];
  nicho: string;
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
      step: Math.min(Math.max(1, Math.round(parsed.step)), 2),
      objetivo: typeof parsed.objetivo === "string" ? parsed.objetivo : "",
      estilos: Array.isArray(parsed.estilos) ? parsed.estilos.filter((v): v is string => typeof v === "string") : [],
      temas: Array.isArray(parsed.temas) ? parsed.temas.filter((v): v is string => typeof v === "string") : [],
      nicho: typeof parsed.nicho === "string" ? parsed.nicho.slice(0, NICHO_MAX) : "",
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function money(cents: number | null | undefined): string | null {
  if (cents == null) return null;
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function OnboardingAside({ step }: { step: Step }) {
  const copy = STEP_COPY[step - 1];

  return (
    <aside className="onboarding-aside" aria-label="O que você ganha em cada etapa">
      <div className="onboarding-aside-art" aria-hidden="true">
        <TemtrendArt idPrefix="tt-onboarding" />
      </div>

      <div className="onboarding-aside-inner">
        <div className="onboarding-aside-copy" key={step}>
          <p className="onboarding-kicker">{copy.kicker}</p>
          <h2>{copy.title}</h2>
          <p className="onboarding-aside-text">{copy.description}</p>
        </div>

        <ol className="onboarding-map" aria-hidden="true">
          {STEP_LABELS.map((label, index) => {
            const number = index + 1;
            const state = number === step ? "is-current" : number < step ? "is-complete" : "";
            return (
              <li key={label} className={state}>
                <span>{number < step ? <Icon name="check" size={12} strokeWidth={2.6} /> : number}</span>
                <div>
                  <strong>{label}</strong>
                  <small>{STEP_COPY[index].hint}</small>
                </div>
              </li>
            );
          })}
        </ol>

        <p className="onboarding-aside-foot">
          <Icon name="check-circle" size={15} />
          Comece grátis. Você decide o plano no final.
        </p>
      </div>
    </aside>
  );
}

export default function Onboarding({ onDone }: { onDone: (target?: string) => void }) {
  const { toast, reloadMe, me } = usePlatform();
  const savedStyles = me?.creator?.estilos_conteudo || [];
  const savedThemes = splitSavedThemes(me?.creator?.temas_interesse);

  const [step, setStep] = useState<Step>(1);
  const [objetivo, setObjetivo] = useState(me?.creator?.objetivo || "");
  const [objetivoError, setObjetivoError] = useState("");
  const [estilos, setEstilos] = useState<string[]>(savedStyles.filter((value) => !value.startsWith("Outro: ")));
  const [temas, setTemas] = useState<string[]>(savedThemes.temas);
  const [nicho, setNicho] = useState(savedThemes.nicho);
  const [nichoError, setNichoError] = useState("");
  const [themeFeedback, setThemeFeedback] = useState("");
  const [showAllThemes, setShowAllThemes] = useState(
    savedThemes.temas.some((theme) => EXTRA_THEMES.includes(theme)),
  );
  const [saving, setSaving] = useState(false);
  const [paying, setPaying] = useState(false);
  const [activating, setActivating] = useState(false);
  const [actionError, setActionError] = useState("");
  const [catalog, setCatalog] = useState<BillingCatalogResponse | null>(null);
  const [catalogState, setCatalogState] = useState<"loading" | "ready" | "error">("loading");
  const [period, setPeriod] = useState<Period>("monthly");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "card">("pix");
  const restoredRef = useRef(false);
  const formRef = useRef<HTMLDivElement>(null);

  // Preço e disponibilidade vêm do backend. Sem catálogo real, não mostramos
  // preço nem liberamos checkout: nada de contratação simulada.
  useEffect(() => {
    let active = true;
    void api<BillingCatalogResponse>("/billing/plans", undefined)
      .then((data) => {
        if (!active) return;
        if (data?.plans?.length) {
          setCatalog(data);
          setCatalogState("ready");
        } else {
          setCatalogState("error");
        }
      })
      .catch(() => { if (active) setCatalogState("error"); });
    return () => { active = false; };
  }, []);

  // Retoma o rascunho salvo uma única vez, depois da hidratação.
  /* eslint-disable react-hooks/set-state-in-effect -- restauração única de rascunho local pós-hidratação */
  useEffect(() => {
    if (restoredRef.current || !me?.user_id) return;
    restoredRef.current = true;
    const draft = readDraft(me.user_id);
    if (!draft) return;
    setObjetivo((current) => current || draft.objetivo);
    setEstilos((current) => (current.length ? current : draft.estilos));
    setTemas((current) => (current.length ? current : draft.temas));
    setNicho((current) => current || draft.nicho);
    if (draft.temas.some((theme) => EXTRA_THEMES.includes(theme))) setShowAllThemes(true);
    if (draft.step > 1) setStep(2);
    if (draft.objetivo || draft.temas.length || draft.estilos.length || draft.nicho) {
      toast("Retomamos de onde você parou.");
    }
  }, [me?.user_id, toast]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // O fim do fluxo não precisa entrar no rascunho.
  useEffect(() => {
    if (!me?.user_id || step >= 3) return;
    const draft: OnboardingDraft = {
      step,
      objetivo,
      estilos,
      temas,
      nicho,
      updatedAt: new Date().toISOString(),
    };
    try {
      window.localStorage.setItem(draftKey(me.user_id), JSON.stringify(draft));
    } catch {
      /* armazenamento indisponível: segue sem rascunho */
    }
  }, [me?.user_id, step, objetivo, estilos, temas, nicho]);

  useEffect(() => {
    if (step !== 3) return;
    track("paywall_view", { source: "onboarding_plan" });
  }, [step]);

  // Ao trocar de etapa, a leitura recomeça do topo e o título recebe foco
  // para leitores de tela. Sem deslocamentos bruscos de layout.
  useEffect(() => {
    const wrap = formRef.current;
    if (!wrap) return;
    wrap.scrollTop = 0;
    const heading = wrap.querySelector<HTMLElement>(".onboarding-step.is-active h1");
    heading?.focus({ preventScroll: true });
    const frame = requestAnimationFrame(() => { wrap.scrollTop = 0; });
    return () => cancelAnimationFrame(frame);
  }, [step]);

  const payloadStyles = useMemo(() => stylesPayload(estilos, ""), [estilos]);
  const payloadThemes = useMemo(() => themesPayload(temas, nicho), [temas, nicho]);

  const pro = catalog?.plans.find((plan) => plan.id === "pro") ?? null;
  const checkoutEnabled = catalog?.enabled === true && catalogState === "ready";
  const launchActive = catalog?.launch?.active === true && Boolean(pro);
  const paid = hasPaidPlan(me?.creator);

  const monthlyCents = pro
    ? launchActive ? pro.precoLancamentoMensalCents ?? pro.precoMensalCents : pro.precoMensalCents
    : null;
  const annualCents = pro
    ? launchActive ? pro.precoLancamentoAnualCents ?? pro.precoAnualCents : pro.precoAnualCents
    : null;
  const price = pro
    ? period === "annual"
      ? launchActive ? pro.precoLancamentoAnual ?? pro.precoAnual : pro.precoAnual
      : launchActive ? pro.precoLancamentoMensal ?? pro.precoMensal : pro.precoMensal
    : null;
  const equivalent = period === "annual" ? money(annualCents != null ? Math.round(annualCents / 12) : null) : null;
  const savingsCents = monthlyCents != null && annualCents != null ? monthlyCents * 12 - annualCents : null;
  const savings = savingsCents != null && savingsCents > 0 ? money(savingsCents) : null;
  const savingsPercent = savingsCents != null && monthlyCents ? Math.round((savingsCents / (monthlyCents * 12)) * 100) : null;
  const bullets = pro ? planBullets(pro).slice(0, 5) : [];
  const busy = saving || paying || activating;

  const expandedThemes = showAllThemes;
  const visibleThemes = [
    ...THEMES,
    ...(expandedThemes ? EXTRA_THEMES : EXTRA_THEMES.filter((theme) => temas.includes(theme))),
  ];
  const selectedObjective = OBJECTIVES.find((item) => item.value === objetivo);
  const themeChips = temas
    .map((theme) => theme === OTHER_THEME ? nicho.trim() : themeLabel(theme))
    .filter(Boolean);

  function clearDraft() {
    try {
      window.localStorage.removeItem("temtrend_onboarding");
      if (me?.user_id) window.localStorage.removeItem(`temtrend_onboarding:${me.user_id}`);
    } catch {
      /* noop */
    }
  }

  function toggleStyle(value: string) {
    setEstilos((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  function toggleTheme(theme: string) {
    setNichoError("");
    setThemeFeedback("");
    if (temas.includes(theme)) {
      setTemas((current) => current.filter((value) => value !== theme));
      return;
    }
    if (temas.length >= THEMES_MAX) {
      setThemeFeedback(`Você já escolheu ${THEMES_MAX} temas. Remova um para adicionar outro.`);
      return;
    }
    setTemas((current) => [...current, theme]);
  }

  async function persistPreferences(overrides?: { objetivo?: string; temas?: string[] }) {
    const session = await resolveSession();
    await api("/creators/onboarding", session?.access_token, {
      method: "POST",
      body: JSON.stringify({
        objetivo: overrides?.objetivo ?? (objetivo || "explorando"),
        estilos_conteudo: payloadStyles,
        temas_interesse: overrides?.temas ?? payloadThemes,
        // Preserva uma voz já salva em Preferências em vez de apagar o dado.
        voz_exemplo: me?.creator?.voz_exemplo ?? "",
      }),
    });
  }

  /** Conclui o cadastro e abre a tela de ativação, antes do painel. */
  async function finishFree() {
    if (busy) return;
    setSaving(true);
    setActionError("");
    try {
      await persistPreferences();
      track("onboarding_completed", { plan: paid ? "paid" : "free" });
      clearDraft();
      setSaving(false);
      setStep(4);
    } catch (error) {
      const message = friendlyError(error, "Não conseguimos salvar suas escolhas agora. Tente novamente.");
      setActionError(message);
      toast(message);
      setSaving(false);
    }
  }

  /** Assina agora: salva o perfil e abre o gateway escolhido (Pix ou cartão). */
  async function subscribe(method: "pix" | "card" = paymentMethod) {
    if (busy || paid || !checkoutEnabled) return;
    setPaying(true);
    setActionError("");
    track("upgrade_click", { source: "onboarding_plan", plan: "pro", period, method });
    track("checkout_started", { source: "onboarding_plan", plan: "pro", period, method });
    try {
      await persistPreferences();
      track("onboarding_completed", { plan: "pro" });
      const session = await resolveSession();
      const result = await api<{ url: string }>("/billing/checkout", session?.access_token, {
        method: "POST",
        body: JSON.stringify({ plan: "pro", period, method }),
      });
      if (!result?.url) throw new Error("Não conseguimos abrir o pagamento agora.");
      clearDraft();
      window.location.assign(result.url);
    } catch (error) {
      const message = friendlyError(error, "Não conseguimos abrir o pagamento agora. Tente novamente.");
      setActionError(message);
      toast(message);
      setPaying(false);
    }
  }

  /** Pula apenas o que é opcional, mantendo o que já foi escolhido. */
  async function skipSetup() {
    if (busy) return;
    setSaving(true);
    setActionError("");
    const safeThemes = temas.filter((theme) => !(theme === OTHER_THEME && !nicho.trim()));
    try {
      await persistPreferences({
        objetivo: objetivo || me?.creator?.objetivo || "explorando",
        temas: themesPayload(safeThemes, nicho),
      });
      track("onboarding_skipped");
      clearDraft();
      setSaving(false);
      setStep(4);
    } catch (error) {
      const message = friendlyError(error, "Não conseguimos pular agora. Tente novamente.");
      setActionError(message);
      toast(message);
      setSaving(false);
    }
  }

  function advance() {
    if (busy) return;
    setActionError("");
    if (step === 1) {
      if (!objetivo) {
        setObjetivoError("Escolha uma opção para continuar.");
        document.querySelector<HTMLElement>(".selection-list .selection-card")?.focus();
        return;
      }
      setObjetivoError("");
      track("onboarding_step", { step: 1 });
      setStep(2);
      return;
    }
    if (step === 2) {
      if (temas.includes(OTHER_THEME) && !nicho.trim()) {
        setNichoError("Conte qual é o seu nicho ou remova a opção Outros para continuar.");
        return;
      }
      setNichoError("");
      track("onboarding_step", { step: 2 });
      setStep(3);
      return;
    }
  }

  function back() {
    if (busy) return;
    setActionError("");
    setObjetivoError("");
    setNichoError("");
    setStep((current) => Math.max(1, current - 1) as Step);
  }

  /** Ativa o espaço: recarrega o perfil e vai direto para a descoberta. */
  async function activate() {
    if (busy) return;
    setActivating(true);
    setActionError("");
    try {
      await reloadMe();
      clearDraft();
      // Já chega no Descobrir com o primeiro interesse no campo, sem disparar
      // uma busca sozinho: a pessoa decide quando gastar a pesquisa.
      const firstTheme = themeChips[0];
      if (firstTheme) {
        try { sessionStorage.setItem("temtrend_pending_search", firstTheme); } catch { /* storage opcional */ }
      }
      onDone("/descobrir");
    } catch (error) {
      const message = friendlyError(error, "Tudo foi salvo. Tente abrir o painel novamente.");
      setActionError(message);
      toast(message);
      setActivating(false);
    }
  }

  const primaryDisabled = busy;
  const done = step === 4;

  return (
    <section id="onboarding" className="onboarding" aria-label="Configurar seu perfil">
      <div className="onboarding-layout">
        <div className="onboarding-main">
          <div className="onboarding-shell">
            <Link className="auth-logo onboarding-logo" href="/" aria-label="TemTrend, página inicial">
              <span aria-hidden="true" /><b>TemTrend</b>
            </Link>

            <div className="onboarding-card-head">
              <span>{done ? "Perfil configurado" : `Etapa ${step} de 3`}</span>
              <span><Icon name="clock" size={13} /> {done ? "Tudo salvo" : "Leva menos de 1 minuto"}</span>
            </div>

            <ol className="onboarding-stepper" aria-label="Etapas da configuração">
              {STEP_LABELS.map((label, index) => {
                const number = index + 1;
                return (
                  <li
                    key={label}
                    className={number === step ? "is-current" : number < step ? "is-complete" : ""}
                    aria-current={number === step ? "step" : undefined}
                  >
                    <span>{number < step ? <Icon name="check" size={12} strokeWidth={2.2} /> : number}</span>
                    {label}
                  </li>
                );
              })}
            </ol>

            <div id="onboarding-form" ref={formRef} data-step={step} aria-busy={busy}>
              <div className={`onboarding-step${step === 1 ? " is-active" : ""}`} data-step="1">
                <div className="onboarding-heading">
                  <p className="eyebrow">Vamos começar</p>
                  <h1 id="onboarding-title" tabIndex={-1}>Qual é o seu objetivo <span className="tt-hl">agora?</span></h1>
                  <p>Uma escolha rápida que muda as sugestões do seu painel. Você pode ajustar depois.</p>
                </div>

                <div
                  className={`selection-list single-select${objetivoError ? " has-error" : ""}`}
                  role="radiogroup"
                  aria-label="Seu objetivo"
                  aria-invalid={objetivoError ? true : undefined}
                  aria-describedby={objetivoError ? "onboarding-objetivo-error" : undefined}
                >
                  {OBJECTIVES.map(({ value, label, detail, icon }) => {
                    const selected = objetivo === value;
                    return (
                      <button
                        key={value}
                        className={`selection-card${selected ? " selected" : ""}`}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => {
                          setObjetivoError("");
                          setObjetivo(selected ? "" : value);
                        }}
                      >
                        <span className="selection-icon"><Icon name={selected ? "check" : icon} size={19} /></span>
                        <span className="selection-copy"><strong>{label}</strong><small>{detail}</small></span>
                        <i aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
                {objetivoError && (
                  <p className="onboarding-field-error" id="onboarding-objetivo-error" role="alert">
                    <Icon name="alert-triangle" size={13} /> {objetivoError}
                  </p>
                )}
              </div>

              <div className={`onboarding-step${step === 2 ? " is-active" : ""}`} data-step="2">
                <div className="onboarding-heading">
                  <p className="eyebrow">Seu conteúdo</p>
                  <h1 tabIndex={-1}>O que você vende define o seu <span className="tt-hl">conteúdo.</span></h1>
                  <p>Escolha seus temas e formatos. A TemTrend usa isso para encontrar produtos e escrever no seu jeito de gravar.</p>
                </div>

                <div className="onboarding-group">
                  <div className="onboarding-group-head">
                    <h2>Temas</h2>
                    <span>{temas.length}/{THEMES_MAX} selecionados</span>
                  </div>
                  <div className="onboarding-theme-grid" role="group" aria-label="Temas de interesse">
                    {visibleThemes.map((theme) => {
                      const selected = temas.includes(theme);
                      return (
                        <button
                          key={theme}
                          type="button"
                          aria-pressed={selected}
                          className={selected ? "selected" : ""}
                          onClick={() => toggleTheme(theme)}
                        >
                          {theme}
                          {selected && <Icon name="check" size={12} strokeWidth={2.4} />}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    className={`onboarding-themes-more${expandedThemes ? " is-open" : ""}`}
                    type="button"
                    aria-expanded={expandedThemes}
                    onClick={() => setShowAllThemes((current) => !current)}
                  >
                    {expandedThemes ? "Ver menos temas" : "Ver mais temas"}
                    <Icon name="chevron-down" size={14} />
                  </button>
                  {temas.includes(OTHER_THEME) && (
                    <label className="onboarding-niche">
                      <span>Qual é o seu nicho?</span>
                      <input
                        type="text"
                        maxLength={NICHO_MAX}
                        autoComplete="off"
                        placeholder="Ex.: festas infantis"
                        value={nicho}
                        aria-invalid={nichoError ? true : undefined}
                        aria-describedby={nichoError ? "onboarding-nicho-error" : undefined}
                        onChange={(event) => { setNicho(event.target.value); setNichoError(""); }}
                      />
                      {nichoError ? (
                        <small className="onboarding-field-error" id="onboarding-nicho-error" role="alert">
                          <Icon name="alert-triangle" size={13} /> {nichoError}
                        </small>
                      ) : (
                        <small>Opcional, mas necessário para usar Outros como um dos temas.</small>
                      )}
                    </label>
                  )}
                  {themeFeedback && (
                    <p className="onboarding-group-feedback" role="status" aria-live="polite">
                      <Icon name="alert-triangle" size={12} /> {themeFeedback}
                    </p>
                  )}
                </div>

                <div className="onboarding-group">
                  <div className="onboarding-group-head">
                    <h2>Formatos de conteúdo</h2>
                    <span>Opcional</span>
                  </div>
                  <div className="onboarding-style-grid">
                    {STYLES.filter((style) => style.value !== "Outro").map(({ value, detail, icon }) => {
                      const selected = estilos.includes(value);
                      return (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={selected}
                          aria-label={value}
                          className={selected ? "selected" : ""}
                          onClick={() => toggleStyle(value)}
                        >
                          <span className="onboarding-style-icon"><Icon name={icon} size={16} /></span>
                          <span className="onboarding-style-copy">
                            <strong>{value}</strong>
                            <small>{detail}</small>
                          </span>
                          <span className="onboarding-style-check" aria-hidden="true">
                            {selected ? <Icon name="check" size={11} strokeWidth={2.6} /> : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className={`onboarding-step onboarding-plan${step === 3 ? " is-active" : ""}`} data-step="3">
                <div className="onboarding-heading onboarding-plan-heading">
                  <p className="eyebrow">Seu plano</p>
                  <h1 tabIndex={-1}>{paid ? <>Seu acesso já está <span className="tt-hl">liberado.</span></> : <>Escolha como <span className="tt-hl">começar.</span></>}</h1>
                  <p>{paid ? "Seu plano está ativo. Entre no painel e comece pelo próximo produto." : "Comece grátis ou libere o Pro para criar sem contar."}</p>
                </div>

                {paid ? (
                  <article className="onboarding-plan-card onboarding-plan-pro is-active-plan">
                    <div className="onboarding-plan-top">
                      <div className="onboarding-plan-name">
                        <strong>Pro</strong>
                        <span>Plano atual</span>
                      </div>
                      <span className="onboarding-plan-tag is-pro">Ativo</span>
                    </div>
                    <ul className="onboarding-plan-list onboarding-plan-list--pro">
                      <li className="is-featured">
                        <span className="onboarding-plan-check" aria-hidden="true"><Icon name="check" size={12} strokeWidth={2.8} /></span>
                        <span>Roteiros e buscas ilimitados</span>
                      </li>
                      <li className="is-featured">
                        <span className="onboarding-plan-check" aria-hidden="true"><Icon name="check" size={12} strokeWidth={2.8} /></span>
                        <span>Catálogo completo de produtos</span>
                      </li>
                      <li>
                        <span className="onboarding-plan-check" aria-hidden="true"><Icon name="check" size={12} strokeWidth={2.8} /></span>
                        <span>Variações e voz personalizada</span>
                      </li>
                      <li>
                        <span className="onboarding-plan-check" aria-hidden="true"><Icon name="check" size={12} strokeWidth={2.8} /></span>
                        <span>Produção sem teto</span>
                      </li>
                    </ul>
                  </article>
                ) : (
                  <>
                    <div className="onboarding-plans">
                      <article className="onboarding-plan-card onboarding-plan-free">
                        <div className="onboarding-plan-top">
                          <div className="onboarding-plan-name">
                            <strong>Grátis</strong>
                            <span>Para começar</span>
                          </div>
                          <span className="onboarding-plan-tag">Recomendado para começar</span>
                        </div>
                        <div className="onboarding-plan-price">
                          <strong>R$ 0</strong>
                          <span>/para começar</span>
                        </div>
                        <p className="onboarding-plan-note">Comece grátis e assine o Pro quando quiser continuar criando.</p>
                        <ul className="onboarding-plan-list">
                          <li><Icon name="check" size={14} strokeWidth={2.4} /> Conteúdo salvo na conta</li>
                          <li><Icon name="check" size={14} strokeWidth={2.4} /> Sem renovação automática</li>
                        </ul>
                      </article>

                      <article className={`onboarding-plan-card onboarding-plan-pro${catalogState !== "ready" ? " is-loading" : ""}`}>
                        <div className="onboarding-plan-top">
                          <div className="onboarding-plan-name">
                            <strong>Pro</strong>
                            <span>{period === "annual" ? "Assinatura anual" : "Assinatura mensal"}</span>
                          </div>
                          {catalogState === "ready" && pro && (
                            <div className="onboarding-period-wrap">
                              {savingsPercent != null && savingsPercent > 0 && (
                                <span className="onboarding-period-discount" title="Desconto no plano anual">
                                  {savingsPercent}% OFF
                                </span>
                              )}
                              <div className="onboarding-period" role="group" aria-label="Periodicidade da cobrança">
                                <button
                                  type="button"
                                  aria-pressed={period === "monthly"}
                                  className={period === "monthly" ? "is-active" : ""}
                                  disabled={busy}
                                  onClick={() => setPeriod("monthly")}
                                >
                                  Mensal
                                </button>
                                <button
                                  type="button"
                                  aria-pressed={period === "annual"}
                                  className={period === "annual" ? "is-active" : ""}
                                  disabled={busy}
                                  onClick={() => setPeriod("annual")}
                                >
                                  Anual
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {catalogState === "loading" && (
                          <div className="onboarding-plan-skeleton" role="status" aria-label="Carregando planos">
                            <span /><span /><span />
                          </div>
                        )}

                        {catalogState === "error" && (
                          <p className="onboarding-plan-offline">
                            Não conseguimos carregar o Pro agora. Você pode continuar grátis e tentar de novo em Planos.
                          </p>
                        )}

                        {catalogState === "ready" && !pro && (
                          <p className="onboarding-plan-offline">
                            O Pro está indisponível agora. Você pode continuar grátis e assinar depois em Planos.
                          </p>
                        )}

                        {catalogState === "ready" && pro && (
                          <>
                            <div className="onboarding-plan-price">
                              <strong>{price ?? "Sob consulta"}</strong>
                              {price && <span>{period === "annual" ? "/ano" : "/mês"}</span>}
                            </div>
                            <p className="onboarding-plan-note">
                              {period === "annual"
                                ? `Cobrado ${price} uma vez por ano${equivalent ? ` · equivale a ${equivalent}/mês` : ""}.`
                                : `Cobrado ${price} por mês. Cancele quando quiser.`}
                            </p>
                            {period === "annual" && savings && savingsPercent != null && (
                              <p className="onboarding-plan-savings">
                                <Icon name="sparkles" size={13} /> Economize {savings} por ano ({savingsPercent}%).
                              </p>
                            )}
                            <ul className="onboarding-plan-list onboarding-plan-list--pro">
                              {bullets.map((bullet, index) => (
                                <li key={bullet} className={index < 2 ? "is-featured" : undefined}>
                                  <span className="onboarding-plan-check" aria-hidden="true">
                                    <Icon name="check" size={12} strokeWidth={2.8} />
                                  </span>
                                  <span>{bullet}</span>
                                </li>
                              ))}
                            </ul>
                            <div className="onboarding-plan-badges">
                              <span><Icon name="pix" size={14} /> Pix ou cartão</span>
                              <span><Icon name="check" size={13} /> Sem fidelidade</span>
                              <span><Icon name="check" size={13} /> Cancele quando quiser</span>
                            </div>
                          </>
                        )}

                        {catalogState === "ready" && catalog?.enabled !== true && (
                          <p className="onboarding-plan-offline">
                            As assinaturas estão indisponíveis por um instante. Você pode começar grátis e assinar depois em Planos.
                          </p>
                        )}
                      </article>
                    </div>

                    <p className="onboarding-plan-footnote">
                      <Icon name="check" size={13} />
                      Você poderá alterar seu plano a qualquer momento nas configurações da conta.
                    </p>
                  </>
                )}
              </div>

              <div className={`onboarding-step onboarding-done${done ? " is-active" : ""}`} data-step="4">
                <div className="onboarding-done-state">
                  <span className="onboarding-done-mark" aria-hidden="true"><Icon name="check" size={20} strokeWidth={2.6} /></span>
                  <p className="eyebrow">Tudo pronto</p>
                  <h1 tabIndex={-1}>Tudo pronto para começar!</h1>
                  <p>Seu espaço está preparado. Agora vamos encontrar produtos e transformar ideias em vídeos.</p>
                  <p className="onboarding-done-personal">{DONE_BY_OBJECTIVE[objetivo] || DONE_BY_OBJECTIVE.explorando}</p>

                  {(selectedObjective || themeChips.length > 0 || payloadStyles.length > 0) && (
                    <div className="onboarding-done-profile" aria-label="Resumo das suas preferências">
                      {selectedObjective && <span><Icon name="target" size={14} /> {selectedObjective.label}</span>}
                      {themeChips.length > 0 && <span><Icon name="grid" size={14} /> {themeChips.slice(0, 3).join(" · ")}</span>}
                      {payloadStyles.length > 0 && <span><Icon name="video" size={14} /> {payloadStyles.slice(0, 2).join(" · ")}</span>}
                    </div>
                  )}

                  <button className="primary onboarding-activate" type="button" disabled={busy} onClick={() => void activate()}>
                    {activating ? "Preparando seu espaço..." : "Encontrar meu primeiro produto"}
                    {!activating && <Icon name="arrow-right" size={16} />}
                  </button>
                  <p className="onboarding-done-note">Seu perfil já está salvo. Você pode ajustar tudo em Preferências.</p>
                </div>
              </div>
            </div>

            {!done && (
              <div className="onboarding-actions">
                <div className="onboarding-actions-main">
                  {step === 3 && !paid ? (
                    <>
                      <button
                        id="onboarding-next"
                        className="primary"
                        type="button"
                        disabled={primaryDisabled}
                        onClick={() => void finishFree()}
                      >
                        {saving ? "Salvando..." : "Continuar gratuitamente"}
                        {!saving && <Icon name="arrow-right" size={16} />}
                      </button>
                      {catalogState === "ready" && checkoutEnabled && (
                        <button
                          className="onboarding-subscribe"
                          type="button"
                          disabled={busy}
                          onClick={() => { setActionError(""); setCheckoutOpen(true); }}
                        >
                          Assinar o Pro
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      id="onboarding-next"
                      className="primary"
                      type="button"
                      disabled={primaryDisabled}
                      onClick={() => void (step === 3 ? finishFree() : advance())}
                    >
                      {saving ? "Salvando..." : step === 3 ? "Começar a usar" : "Continuar"}
                      {!saving && <Icon name="arrow-right" size={16} />}
                    </button>
                  )}
                </div>

                {actionError && (
                  <p className="onboarding-action-error" role="alert">
                    <Icon name="alert-triangle" size={13} /> {actionError}
                  </p>
                )}

                <div className="onboarding-actions-foot">
                  {step > 1 ? (
                    <button className="onboarding-back" type="button" onClick={back} disabled={busy}>
                      <Icon name="arrow-left" size={14} /> Voltar
                    </button>
                  ) : (
                    <span aria-hidden="true" />
                  )}
                  {step === 2 && (
                    <button
                      className="onboarding-skip"
                      type="button"
                      title="Temas e formatos são opcionais. O que você já escolheu é mantido."
                      onClick={() => void skipSetup()}
                      disabled={busy}
                    >
                      Pular temas e formatos
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <OnboardingAside step={step} />
      </div>

      {checkoutOpen && (
        <Modal
          titleId="onboarding-checkout-title"
          busy={paying}
          onClose={() => { if (!paying) { setCheckoutOpen(false); setActionError(""); } }}
          className="onboarding-payment-dialog"
        >
          <div className="onboarding-payment-modal">
            <button
              className="dialog-close"
              type="button"
              aria-label="Fechar"
              disabled={paying}
              onClick={() => { setCheckoutOpen(false); setActionError(""); }}
            >
              <Icon name="x" size={18} />
            </button>
            <p className="eyebrow">Assinar o Pro</p>
            <h2 id="onboarding-checkout-title">Escolha como pagar.</h2>
            <p className="onboarding-payment-lead">
              Você será levado ao ambiente seguro do gateway. Cancele quando quiser.
            </p>

            <div className="onboarding-payment-summary">
              <span><small>Plano</small><strong>Pro</strong></span>
              <span><small>Período</small><strong>{period === "annual" ? "Anual" : "Mensal"}</strong></span>
              <span><small>Total</small><strong>{price}</strong></span>
            </div>

            <div className="onboarding-payment-methods" role="radiogroup" aria-label="Forma de pagamento">
              <button
                type="button"
                role="radio"
                aria-checked={paymentMethod === "pix"}
                className={paymentMethod === "pix" ? "is-active" : ""}
                disabled={paying}
                onClick={() => setPaymentMethod("pix")}
              >
                <span className="onboarding-payment-icon"><Icon name="pix" size={18} /></span>
                <span className="onboarding-payment-copy">
                  <strong>Pix</strong>
                  <small>Pague o período escolhido. Sem renovação automática.</small>
                </span>
                <i aria-hidden="true" />
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={paymentMethod === "card"}
                className={paymentMethod === "card" ? "is-active" : ""}
                disabled={paying}
                onClick={() => setPaymentMethod("card")}
              >
                <span className="onboarding-payment-icon"><Icon name="plan" size={18} /></span>
                <span className="onboarding-payment-copy">
                  <strong>Cartão</strong>
                  <small>Assinatura recorrente com renovação automática.</small>
                </span>
                <i aria-hidden="true" />
              </button>
            </div>

            {actionError && (
              <p className="onboarding-action-error" role="alert">
                <Icon name="alert-triangle" size={13} /> {actionError}
              </p>
            )}

            <div className="onboarding-payment-actions">
              <button
                className="ghost"
                type="button"
                disabled={paying}
                onClick={() => { setCheckoutOpen(false); setActionError(""); }}
              >
                Agora não
              </button>
              <button
                className="primary onboarding-payment-confirm"
                type="button"
                disabled={paying}
                onClick={() => void subscribe(paymentMethod)}
              >
                {paying
                  ? "Abrindo o pagamento..."
                  : paymentMethod === "pix" ? "Ir para o pagamento Pix" : "Ir para o pagamento com cartão"}
              </button>
            </div>

            <p className="onboarding-payment-note">
              <Icon name="lock" size={13} /> Pagamento processado em ambiente seguro.
            </p>
          </div>
        </Modal>
      )}
    </section>
  );
}
