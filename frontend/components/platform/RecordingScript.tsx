"use client";

import { copyText, normalizeScenes } from "@/lib/format";
import type { ContentKit } from "@/lib/types";
import { usePlatform } from "./store";
import { kitCopyText, sceneParts } from "./kit-text";

/** Roteiro para gravar dentro do popup do chat: hook, cenas, legenda, CTA, hashtags e áudio. */
export default function RecordingScript({ kit, readyLabel, readyDisabled, onReady }: {
  kit: ContentKit;
  readyLabel: string;
  readyDisabled?: boolean;
  onReady: () => void;
}) {
  const { toast } = usePlatform();
  const scenes = normalizeScenes(kit.cenas);
  const hashtags = (kit.hashtags || []).map((tag) => (tag.startsWith("#") ? tag : `#${tag}`));

  async function copy(value: string, label: string) {
    const copied = await copyText(value);
    toast(copied ? `${label} copiado.` : "Não foi possível copiar. Selecione o texto.");
  }

  return (
    <div className="rs-script rs-full-page">
      {kit.hook && (
        <section className="rs-block">
          <div className="rs-head"><span className="rs-label">Gancho · primeiros 3 segundos</span><button className="ghost rs-copy" type="button" onClick={() => void copy(kit.hook!, "Gancho")}>Copiar</button></div>
          <p className="rs-hook-text">{kit.hook}</p>
        </section>
      )}

      <section className="rs-block">
        <span className="rs-label">Cenas</span>
        <ol className="rs-scenes">
          {scenes.map((scene, index) => {
            const parts = typeof scene === "string" ? { show: scene, say: "", time: "", edit: "" } : sceneParts(scene);
            return (
              <li key={index} className="rs-scene">
                <div className="rs-scene-head">
                  <strong>Cena {String(index + 1).padStart(2, "0")}</strong>
                  {parts.time && <span>{parts.time}</span>}
                </div>
                {parts.show && <p><b>Mostre:</b> {parts.show}</p>}
                {parts.say && <p><b>Fale:</b> {parts.say}</p>}
                {parts.edit && <p><b>Edição:</b> {parts.edit}</p>}
              </li>
            );
          })}
        </ol>
      </section>

      {kit.roteiro && (
        <section className="rs-block">
          <div className="rs-head"><span className="rs-label">Roteiro</span><button className="ghost rs-copy" type="button" onClick={() => void copy(kit.roteiro!, "Roteiro")}>Copiar</button></div>
          <p className="rs-text">{kit.roteiro}</p>
        </section>
      )}

      {kit.copy && (
        <section className="rs-block">
          <div className="rs-head"><span className="rs-label">Legenda</span><button className="ghost rs-copy" type="button" onClick={() => void copy(kit.copy!, "Legenda")}>Copiar</button></div>
          <p className="rs-text">{kit.copy}</p>
        </section>
      )}

      {kit.cta && (
        <section className="rs-block">
          <div className="rs-head"><span className="rs-label">CTA</span><button className="ghost rs-copy" type="button" onClick={() => void copy(kit.cta!, "CTA")}>Copiar</button></div>
          <p className="rs-text">{kit.cta}</p>
        </section>
      )}

      {hashtags.length > 0 && (
        <section className="rs-block">
          <div className="rs-head"><span className="rs-label">Hashtags</span><button className="ghost rs-copy" type="button" onClick={() => void copy(hashtags.join(" "), "Hashtags")}>Copiar</button></div>
          <div className="rs-chips">{hashtags.map((tag) => <span key={tag}>{tag}</span>)}</div>
        </section>
      )}

      {kit.audio_sugerido && (
        <section className="rs-block">
          <div className="rs-head"><span className="rs-label">Áudio sugerido</span><button className="ghost rs-copy" type="button" onClick={() => void copy(kit.audio_sugerido!, "Áudio")}>Copiar</button></div>
          <p className="rs-text">{kit.audio_sugerido}</p>
        </section>
      )}

      <footer className="rs-footer">
        <button className="ghost" type="button" onClick={() => void copy(kitCopyText(kit), "Roteiro completo")}>Copiar roteiro completo</button>
        <button className="primary" type="button" disabled={readyDisabled} onClick={onReady}>{readyLabel}</button>
      </footer>
    </div>
  );
}
