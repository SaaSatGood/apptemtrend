"use client";

import { useMemo, useState } from "react";
import Icon from "@/components/ui/Icon";
import { api, friendlyError } from "@/lib/api";
import { resolveSession } from "@/lib/supabase";
import { OBJECTIVES, STYLES, THEMES, EXTRA_THEMES, THEMES_MAX, VOZ_MAX, NICHO_MAX, OTHER_THEME, splitSavedThemes, stylesPayload, themesPayload } from "@/lib/creator-preferences";
import {
  VOICE_TONES,
  joinVoiceTone,
  splitVoiceTone,
  voiceExample,
  voiceToneSentence,
  type VoiceTone,
} from "@/lib/voice";
import Link from "next/link";
import { hasPaidPlan } from "@/lib/plan-access";
import { usePlatform } from "./store";

/** Compara listas como conjuntos: a ordem dos cliques não pode sujar o formulário. */
function sameSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const normalize = (values: string[]) => [...values].sort().join("\u0000");
  return normalize(left) === normalize(right);
}

/**
 * Configurações que a IA usa para buscar produtos e escrever roteiros:
 * objetivo, formato, nichos e voz. Fica fora da conta e fora do onboarding,
 * então pode ser ajustada a qualquer momento.
 */
export default function Preferences() {
  const { me, reloadMe, toast } = usePlatform();
  const voiceLocked = !hasPaidPlan(me?.creator);
  const savedStyles = me?.creator?.estilos_conteudo || [];
  const savedOutro = savedStyles.find((value) => value.startsWith("Outro: "))?.slice(7) || "";
  const savedThemes = splitSavedThemes(me?.creator?.temas_interesse);
  const savedVoice = splitVoiceTone(me?.creator?.voz_exemplo || "");
  const [objetivo, setObjetivo] = useState(me?.creator?.objetivo || "");
  const [estilos, setEstilos] = useState<string[]>(savedStyles.filter((value) => !value.startsWith("Outro: ")));
  const [estiloOutro, setEstiloOutro] = useState(savedOutro);
  const [temas, setTemas] = useState<string[]>(savedThemes.temas);
  const [nicho, setNicho] = useState(savedThemes.nicho);
  const [tom, setTom] = useState<VoiceTone | null>(savedVoice.tone);
  const [voz, setVoz] = useState(savedVoice.text);
  const [saving, setSaving] = useState(false);
  // Temas extras ficam atrás de "Ver mais temas", como no onboarding, para a
  // primeira leitura mostrar só as escolhas mais prováveis.
  const [showAllThemes, setShowAllThemes] = useState(
    savedThemes.temas.some((theme) => EXTRA_THEMES.includes(theme)),
  );
  const [themeFeedback, setThemeFeedback] = useState("");
  // Guarda o texto anterior quando o exemplo é aplicado, para desfazer sem
  // apagar o que a pessoa já tinha escrito.
  const [undoVoice, setUndoVoice] = useState<{ text: string; tone: VoiceTone | null } | null>(null);

  const payloadStyles = useMemo(() => stylesPayload(estilos, estiloOutro), [estilos, estiloOutro]);
  const payloadThemes = useMemo(() => themesPayload(temas, nicho), [temas, nicho]);
  const savedPayloadThemes = splitSavedThemes(me?.creator?.temas_interesse);
  const savedThemesPayload = themesPayload(savedPayloadThemes.temas, savedPayloadThemes.nicho);
  const savedPayloadStyles = savedStyles
    .filter((value) => !value.startsWith("Outro: "))
    .concat(savedOutro ? [`Outro: ${savedOutro}`] : []);
  const tonePrefix = tom ? `${voiceToneSentence(tom)} ` : "";
  const vozLimit = Math.max(1, VOZ_MAX - tonePrefix.length);
  const vozPayload = joinVoiceTone(voz, tom).slice(0, VOZ_MAX);
  const savedVoicePayload = joinVoiceTone(savedVoice.text, savedVoice.tone).slice(0, VOZ_MAX);

  const objetivoChanged = objetivo !== (me?.creator?.objetivo || "");
  const stylesChanged = !sameSet(payloadStyles, savedPayloadStyles);
  const themesChanged = !sameSet(payloadThemes, savedThemesPayload);
  const voiceChanged = vozPayload !== savedVoicePayload;
  const changedCount = [objetivoChanged, stylesChanged, themesChanged, voiceChanged].filter(Boolean).length;
  const dirty = changedCount > 0;

  const visibleThemes = [
    ...THEMES,
    ...(showAllThemes ? EXTRA_THEMES : EXTRA_THEMES.filter((theme) => temas.includes(theme))),
  ];
  const themeLimitReached = temas.length >= THEMES_MAX;

  function toggleStyle(value: string) {
    setEstilos((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  function toggleTheme(theme: string) {
    setThemeFeedback("");
    if (temas.includes(theme)) {
      setTemas((current) => current.filter((item) => item !== theme));
      return;
    }
    if (temas.length >= THEMES_MAX) {
      setThemeFeedback(`Você já escolheu ${THEMES_MAX} nichos. Remova um para adicionar outro.`);
      return;
    }
    setTemas((current) => [...current, theme]);
  }

  function chooseTone(next: VoiceTone) {
    const selected = tom === next ? null : next;
    const prefix = selected ? `${voiceToneSentence(selected)} ` : "";
    setTom(selected);
    setVoz((current) => current.slice(0, Math.max(1, VOZ_MAX - prefix.length)));
  }

  function writeExample() {
    const nextTone = tom ?? VOICE_TONES[0];
    const theme = me?.creator?.temas_interesse?.[0];
    const example = voiceExample(nextTone, theme)
      .slice(0, Math.max(1, VOZ_MAX - voiceToneSentence(nextTone).length - 1));
    // Só oferece desfazer quando havia texto próprio em risco.
    setUndoVoice(voz.trim() && voz.trim() !== example ? { text: voz, tone: tom } : null);
    setTom(nextTone);
    setVoz(example);
  }

  function undoExample() {
    if (!undoVoice) return;
    setTom(undoVoice.tone);
    setVoz(undoVoice.text);
    setUndoVoice(null);
  }

  function clearVoice() {
    setVoz("");
    setUndoVoice(null);
  }

  /** Setas navegam entre os objetivos, como num grupo de rádio nativo. */
  function handleObjectiveKeys(event: React.KeyboardEvent<HTMLDivElement>) {
    const navigationKeys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"];
    if (!navigationKeys.includes(event.key)) return;
    event.preventDefault();
    const total = OBJECTIVES.length;
    const current = OBJECTIVES.findIndex((item) => item.value === objetivo);
    let next = current;
    if (event.key === "Home") next = 0;
    else if (event.key === "End") next = total - 1;
    else if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (Math.max(current, -1) + 1) % total;
    else next = (current <= 0 ? total : current) - 1;
    setObjetivo(OBJECTIVES[next].value);
    event.currentTarget
      .querySelectorAll<HTMLButtonElement>('button[role="radio"]')
      .item(next)
      ?.focus();
  }

  function discard() {
    setObjetivo(me?.creator?.objetivo || "");
    setEstilos(savedStyles.filter((value) => !value.startsWith("Outro: ")));
    setEstiloOutro(savedOutro);
    setTemas(savedPayloadThemes.temas);
    setNicho(savedPayloadThemes.nicho);
    const restored = splitVoiceTone(me?.creator?.voz_exemplo || "");
    setTom(restored.tone);
    setVoz(restored.text);
    setThemeFeedback("");
    setUndoVoice(null);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (!objetivo) {
      toast("Escolha seu objetivo principal para a IA.");
      return;
    }
    setSaving(true);
    try {
      const session = await resolveSession();
      await api("/creators/onboarding", session?.access_token, {
        method: "POST",
        body: JSON.stringify({
          objetivo,
          estilos_conteudo: payloadStyles,
          temas_interesse: payloadThemes,
          voz_exemplo: vozPayload,
        }),
      });
      await reloadMe();
      setUndoVoice(null);
      toast("Preferências salvas. A IA já usa esses ajustes.");
    } catch (error) {
      toast(friendlyError(error, "Não conseguimos salvar suas preferências. Tente novamente."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="tt-prefs" onSubmit={(event) => void save(event)}>
      <header className="tt-prefs-head">
        <h1>
          Ajuste como a IA <span className="tt-hl">responde</span>
        </h1>
        <p>
          Essas escolhas orientam as buscas de produtos e os roteiros que a TemTrend gera.
          Você pode mudar quando quiser.
        </p>
      </header>

      <section className="card tt-prefs-card" aria-labelledby="prefs-objetivo">
        <div className="tt-prefs-card-head">
          <div>
            <h2 id="prefs-objetivo">Seu objetivo agora</h2>
            <p>Define o tom das sugestões e o foco das buscas.</p>
          </div>
          {objetivoChanged && <span className="tt-prefs-changed">Alterado</span>}
        </div>
        <div
          className="tt-prefs-objectives"
          role="radiogroup"
          aria-labelledby="prefs-objetivo"
          onKeyDown={handleObjectiveKeys}
        >
          {OBJECTIVES.map((item) => {
            const active = objetivo === item.value;
            return (
              <button
                key={item.value}
                type="button"
                role="radio"
                aria-checked={active}
                tabIndex={active || (!objetivo && item === OBJECTIVES[0]) ? 0 : -1}
                className={active ? "is-active" : undefined}
                onClick={() => setObjetivo(item.value)}
              >
                <span className="tt-prefs-objective-icon"><Icon name={item.icon} size={16} /></span>
                <span className="tt-prefs-objective-copy">
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </span>
                <span className={`tt-prefs-radio${active ? " is-on" : ""}`} aria-hidden="true">
                  {active && <Icon name="check" size={11} strokeWidth={3} />}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="tt-prefs-duo">
        <section className="card tt-prefs-card" aria-labelledby="prefs-formatos">
          <div className="tt-prefs-card-head">
            <div>
              <h2 id="prefs-formatos">Formatos que você grava</h2>
              <p>Os roteiros seguem os formatos marcados aqui.</p>
            </div>
            {stylesChanged && <span className="tt-prefs-changed">Alterado</span>}
          </div>
          <div className="tt-prefs-chips tt-prefs-chips--formats" role="group" aria-labelledby="prefs-formatos">
            {STYLES.map((style) => (
              <button
                key={style.value}
                type="button"
                aria-pressed={estilos.includes(style.value)}
                className={[
                  estilos.includes(style.value) ? "is-active" : "",
                  style.value === "Outro" ? "is-wide" : "",
                ].filter(Boolean).join(" ") || undefined}
                onClick={() => toggleStyle(style.value)}
              >
                <Icon name={style.icon} size={14} />
                <span>{style.value}</span>
                {style.value === "Outro" && <Icon name="arrow-right" size={14} className="tt-prefs-chip-arrow" />}
              </button>
            ))}
          </div>
          {estilos.includes("Outro") && (
            <label className="tt-prefs-outro">
              Descreva o seu formato
              <input
                type="text"
                maxLength={50}
                autoComplete="off"
                placeholder="Ex.: react em dupla"
                value={estiloOutro}
                onChange={(event) => setEstiloOutro(event.target.value)}
              />
            </label>
          )}
        </section>

        <section className="card tt-prefs-card" aria-labelledby="prefs-nichos">
          <div className="tt-prefs-card-head">
            <div>
              <h2 id="prefs-nichos">Nichos de interesse</h2>
              <p>Até {THEMES_MAX} nichos viram atalhos no Descobrir e afinam as sugestões.</p>
            </div>
            <div className="tt-prefs-card-tags">
              {themesChanged && <span className="tt-prefs-changed">Alterado</span>}
              <span className={`tt-prefs-count${themeLimitReached ? " is-full" : ""}`}>
                {temas.length}/{THEMES_MAX} selecionados
              </span>
            </div>
          </div>
          <div
            id="prefs-themes-grid"
            className="tt-prefs-chips tt-prefs-chips--themes"
            role="group"
            aria-labelledby="prefs-nichos"
            aria-describedby={themeFeedback ? "prefs-nichos-feedback" : undefined}
          >
            {visibleThemes.map((theme) => (
              <button
                key={theme}
                type="button"
                aria-pressed={temas.includes(theme)}
                className={temas.includes(theme) ? "is-active" : undefined}
                onClick={() => toggleTheme(theme)}
              >
                {theme}
                {temas.includes(theme) && <Icon name="check" size={12} strokeWidth={2.4} className="tt-prefs-chip-check" />}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`tt-prefs-more${showAllThemes ? " is-open" : ""}`}
            aria-expanded={showAllThemes}
            aria-controls="prefs-themes-grid"
            onClick={() => setShowAllThemes((current) => !current)}
          >
            {showAllThemes ? "Ver menos temas" : "Ver mais temas"}
            <Icon name="chevron-down" size={14} />
          </button>
          {themeFeedback && (
            <p className="tt-prefs-feedback" id="prefs-nichos-feedback" role="status">
              <Icon name="alert-triangle" size={13} /> {themeFeedback}
            </p>
          )}
          {temas.includes(OTHER_THEME) && (
            <label className="tt-prefs-outro">
              Qual é o seu nicho?
              <input
                type="text"
                maxLength={NICHO_MAX}
                autoComplete="off"
                placeholder="Ex.: festas infantis"
                value={nicho}
                onChange={(event) => setNicho(event.target.value)}
              />
            </label>
          )}
        </section>
      </div>

      <section className="card tt-prefs-card" aria-labelledby="prefs-voz">
        <div className="tt-prefs-card-head">
          <div>
            <h2 id="prefs-voz">Sua voz</h2>
            {voiceLocked ? (
              <p>
                A voz personalizada é um recurso do Pro: os roteiros novos saem no seu jeito de falar.{" "}
                <Link href="/conta/planos">Ver o Pro</Link>
              </p>
            ) : (
              <p>Os roteiros novos saem no seu jeito de falar. Opcional.</p>
            )}
          </div>
          <div className="tt-prefs-card-tags">
            {voiceChanged && <span className="tt-prefs-changed">Alterado</span>}
            {!voiceLocked && (
              <button type="button" className="tt-prefs-example" onClick={writeExample}>
                <Icon name="sparkles" size={13} />
                Escrever um exemplo para mim
              </button>
            )}
            {voiceLocked && <span className="tt-prefs-changed">Pro</span>}
          </div>
        </div>
        <div className="tt-prefs-voice">
          <span className="tt-prefs-label" id="prefs-tom">Tom de voz</span>
          <div className="tt-prefs-tones" role="group" aria-labelledby="prefs-tom">
            {VOICE_TONES.map((tone) => (
              <button
                key={tone}
                type="button"
                aria-pressed={tom === tone}
                className={tom === tone ? "is-active" : undefined}
                disabled={voiceLocked}
                onClick={() => chooseTone(tone)}
              >
                {tone}
              </button>
            ))}
          </div>
          <label className="tt-prefs-label" htmlFor="prefs-voz-texto">
            Descreva seu jeito de falar ou cole um roteiro de exemplo <span>(opcional)</span>
          </label>
          <textarea
            id="prefs-voz-texto"
            rows={6}
            maxLength={vozLimit}
            aria-describedby="prefs-voz-contador"
            placeholder={voiceLocked ? "Disponível no plano Pro." : "Ex.: Gente, preciso mostrar isso pra vocês..."}
            value={voz}
            readOnly={voiceLocked}
            disabled={voiceLocked}
            onChange={(event) => { setVoz(event.target.value); setUndoVoice(null); }}
          />
          <div className="tt-prefs-voice-foot">
            <small className="tt-prefs-counter" id="prefs-voz-contador">{voz.length} de {vozLimit} caracteres</small>
            <div className="tt-prefs-voice-tools">
              {undoVoice && (
                <button type="button" className="tt-prefs-link" onClick={undoExample}>
                  Desfazer exemplo
                </button>
              )}
              {voz.length > 0 && (
                <button type="button" className="tt-prefs-link" onClick={clearVoice}>
                  Limpar texto
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <footer className={`tt-prefs-actions${dirty ? " is-dirty" : ""}`}>
        <span className="tt-prefs-status" role="status" aria-live="polite">
          {dirty
            ? `Alterações não salvas em ${changedCount} ${changedCount === 1 ? "seção" : "seções"}.`
            : "Tudo salvo."}
        </span>
        <div className="tt-prefs-action-buttons">
          <button type="button" className="tt-prefs-discard" onClick={discard} disabled={saving || !dirty}>
            Descartar
          </button>
          <button type="submit" className="tt-prefs-save" disabled={saving || !dirty} aria-busy={saving}>
            {saving ? "Salvando..." : "Salvar preferências"}
          </button>
        </div>
      </footer>
    </form>
  );
}
