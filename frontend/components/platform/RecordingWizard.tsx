"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import { copyText, normalizeScenes, shortProductName } from "@/lib/format";
import type { ContentKit, Product } from "@/lib/types";
import { kitCopyText, sceneParts } from "./kit-text";
import { usePlatform } from "./store";
import ProductImage from "./ProductImage";
import RecordingScript from "./RecordingScript";
import EmphasizedTitle from "./EmphasizedTitle";
import Modal from "./Modal";

const CHECKLIST = ["Produto à mão", "Boa luz", "Fundo organizado", "Lente limpa"];
const TIP = "Grave perto de uma janela, de frente para a luz. Apoie o celular na altura dos olhos e grave na vertical: o quadro fica limpo e o produto aparece sem esforço.";

type Step = {
  kind: "prep" | "hook" | "scene";
  title: string;
  time: string;
  show: string;
  say: string;
  edit: string;
};

type StepState = "done" | "current" | "pending";

/** Modo gravação em etapas (popup do chat e de Conteúdos). */
export default function RecordingWizard({ kit, product, readyLabel, readyDisabled, statusLabel, onReady, onDelete, onClose }: {
  kit: ContentKit;
  product: Product;
  readyLabel: string;
  readyDisabled?: boolean;
  /** Estado real da produção (salvo, em produção, gravado, publicado). */
  statusLabel: string;
  onReady: () => void;
  /** Exclui este roteiro. Resolve false quando a exclusão falhar. */
  onDelete: () => Promise<boolean>;
  onClose?: () => void;
}) {
  const { toast } = usePlatform();
  const [current, setCurrent] = useState(0);
  const [done, setDone] = useState<number[]>([]);
  const [checked, setChecked] = useState<boolean[]>(CHECKLIST.map(() => false));
  const [menuOpen, setMenuOpen] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const steps = useMemo<Step[]>(() => {
    const scenes = normalizeScenes(kit.cenas).map((scene, index) => {
      const parts = typeof scene === "string" ? { show: scene, say: "", time: "", edit: "" } : sceneParts(scene);
      return { kind: "scene" as const, title: `Cena ${index + 1}`, time: parts.time, show: parts.show, say: parts.say, edit: parts.edit };
    });
    const hook = String(kit.hook ?? "").trim();
    return [
      { kind: "prep", title: "Preparar", time: "", show: "", say: "", edit: "" },
      // Sem gancho gerado, a etapa de abertura ficaria vazia: só entra quando há texto.
      ...(hook ? [{ kind: "hook" as const, title: "Abertura", time: "", show: "", say: hook, edit: "" }] : []),
      ...scenes,
    ];
  }, [kit]);

  const last = steps.length - 1;
  const step = steps[current];
  const next = steps[current + 1];

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: PointerEvent) => {
      if (!(event.target as HTMLElement).closest(".rw-menu-wrap")) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menuOpen]);

  function stateOf(index: number): StepState {
    if (index === current) return "current";
    return index < current || done.includes(index) ? "done" : "pending";
  }

  function advance() {
    setDone((list) => (list.includes(current) ? list : [...list, current]));
    if (current === last) {
      onReady();
      return;
    }
    setCurrent(current + 1);
  }

  function ctaLabel(): string {
    if (current === last) return readyLabel;
    if (step.kind === "prep") return "Começar a gravar";
    if (step.kind === "hook") return "Abertura gravada";
    return "Cena gravada";
  }

  async function copy(value: string, message: string) {
    const copied = await copyText(value);
    toast(copied ? message : "Não foi possível copiar. Selecione o texto.");
  }

  async function confirmDeleteKit() {
    if (deleting) return;
    setDeleting(true);
    const removed = await onDelete();
    setDeleting(false);
    if (removed) setConfirmDelete(false);
  }

  const readyCount = checked.filter(Boolean).length;
  const productName = shortProductName(String(product.nome ?? ""));
  const metaBase = [product.categoria, product.preco_texto]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" · ");
  const metaChips = [
    { label: "Formato", value: kit.formato },
    { label: "Nível", value: kit.nivel_dificuldade },
  ].filter((chip): chip is { label: string; value: string } => Boolean(chip.value?.trim()));

  const header = (
    <>
      <div className="rw-topbar">
        {onClose ? (
          <button type="button" className="rw-back" onClick={onClose}>← Conteúdos</button>
        ) : (
          <Link className="rw-back" href={`/produtos/${product.id}`}>← Voltar ao produto</Link>
        )}
        <div className="rw-menu-wrap rw-top-right">
          <span className="rw-status" aria-live="polite">{statusLabel}</span>
          <button type="button" className="rw-menu-trigger" aria-haspopup="menu" aria-expanded={menuOpen} aria-label="Mais opções do roteiro" title="Mais opções" onClick={() => setMenuOpen((open) => !open)}><Icon name="more-horizontal" size={19} /></button>
          {menuOpen && (
            <div className="rw-menu" role="menu">
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setShowFull(true); }}>Ver roteiro completo</button>
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); void copy(kitCopyText(kit), "Plano copiado."); }}>Copiar plano</button>
              {product.nome && product.tiktok_shop_url && <a role="menuitem" href={product.tiktok_shop_url} target="_blank" rel="noopener noreferrer" className="rw-menu-link">Ver produto</a>}
              <button type="button" role="menuitem" className="is-danger" onClick={() => { setMenuOpen(false); setConfirmDelete(true); }}>Excluir roteiro</button>
            </div>
          )}
        </div>
      </div>
      <header className="rw-product">
        <div className="rw-product-thumb">
          <ProductImage product={product} width={56} height={56} />
        </div>
        <div>
          <h1 title={product.nome}><EmphasizedTitle text={productName} /></h1>
          {product.nome !== productName && <p className="rw-product-full" title={product.nome}>{product.nome}</p>}
          {(metaBase || metaChips.length > 0) && (
            <p className="rw-product-meta">
              {metaBase && <span>{metaBase}</span>}
              {metaChips.map((chip) => (
                <span className="rw-meta-chip" key={chip.label}>
                  <small>{chip.label}</small>
                  {chip.value}
                </span>
              ))}
            </p>
          )}
        </div>
      </header>
    </>
  );

  if (showFull) {
    return (
      <div className="rw">
        {header}
        <button type="button" className="rw-step-back rw-full-back" onClick={() => setShowFull(false)}>← Voltar ao guia</button>
        <RecordingScript kit={kit} readyLabel={readyLabel} readyDisabled={readyDisabled} onReady={onReady} />
      </div>
    );
  }

  return (
    <div className="rw">
      {header}

      <div className="rw-progress">
        <span>Etapa {current + 1} de {steps.length} · {step.title}</span>
        <div className="rw-bar" aria-hidden="true">
          {steps.map((_, index) => (
            <i key={index} className={stateOf(index) === "pending" ? undefined : stateOf(index) === "current" ? "is-current" : "is-done"} />
          ))}
        </div>
      </div>

      <div className="rw-body">
        <section className="rw-main">
          {step.kind === "prep" && (
            <>
              <p className="rw-kicker">Antes de começar</p>
              <h2>Antes de gravar</h2>
              <p className="rw-desc">Deixe tudo à mão. Uma boa base evita regravar depois.</p>
              <div className="rw-checks">
                {CHECKLIST.map((label, index) => (
                  <label
                    key={label}
                    className={`rw-check${checked[index] ? " is-checked" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked[index]}
                      onChange={() => setChecked((list) => list.map((value, i) => (i === index ? !value : value)))}
                      className="rw-check-input"
                    />
                    <span className="rw-box">{checked[index] ? <Icon name="check" size={13} /> : null}</span>
                    <span className="rw-check-label">{label}</span>
                  </label>
                ))}
              </div>
              <p className="rw-tip"><strong>Dica:</strong> {TIP}</p>
            </>
          )}

          {step.kind === "hook" && (
            <>
              <p className="rw-kicker">Gancho</p>
              <h2>Abertura</h2>
              <p className="rw-desc">Os primeiros segundos prendem a atenção. Fale o gancho logo no começo.</p>
              {step.say && <p className="rw-quote">“{step.say}”</p>}
              {step.say && <button type="button" className="rw-step-back" onClick={() => void copy(step.say, "Gancho copiado.")}>Copiar gancho</button>}
            </>
          )}

          {step.kind === "scene" && (
            <>
              <p className="rw-kicker">{step.time ? `${step.title} · ${step.time}` : step.title}</p>
              <h2>{step.title}</h2>
              {step.show && <div className="rw-block"><small>Mostre</small><p>{step.show}</p></div>}
              {step.say && <div className="rw-block"><small>Fale</small><p>{step.say}</p></div>}
              {step.edit && <div className="rw-block"><small>Ação / edição</small><p>{step.edit}</p></div>}
            </>
          )}

          <button type="button" className={`rw-cta${step.kind === "prep" && readyCount < CHECKLIST.length ? " is-quiet" : ""}`} onClick={advance} disabled={current === last && readyDisabled}>
            {ctaLabel()}
          </button>
          {current > 0 && <button type="button" className="rw-step-back" onClick={() => setCurrent(current - 1)}>← Etapa anterior</button>}
          <p className="rw-next">
            {next ? `Próxima: ${next.title}${next.kind === "hook" ? " (gancho)" : ""}` : "Última etapa"}
            <span className="rw-sep"> · </span>
            {readyCount === CHECKLIST.length ? <span className="rw-ready"><Icon name="check" size={13} /> Tudo pronto</span> : `${readyCount} de ${CHECKLIST.length} prontos`}
          </p>
        </section>

        <aside className="rw-plan">
          <h3>Seu plano</h3>
          <ol>
            {steps.map((item, index) => {
              const state = stateOf(index);
              const line = state === "current"
                ? "Etapa atual"
                : state === "done"
                  ? "Concluída"
                  : item.kind === "hook"
                    ? "Gancho"
                    : item.kind === "scene" && item.time
                      ? item.time
                      : "Pendente";
              return (
                <li key={index} className={state === "current" ? "is-current" : state === "done" ? "is-done" : undefined}>
                  <button type="button" aria-current={state === "current" ? "step" : undefined} onClick={() => setCurrent(index)}>
                    <span className="rw-num">{state === "done" ? <Icon name="check" size={12} /> : index + 1}</span>
                    <span>
                      <strong>{item.title}</strong>
                      <small>{line}</small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>
      </div>

      {confirmDelete && (
        <Modal
          titleId="rw-delete-title"
          onClose={() => { if (!deleting) setConfirmDelete(false); }}
          busy={deleting}
        >
          <div className="stack">
            <p className="eyebrow">Excluir roteiro</p>
            <h2 id="rw-delete-title">Excluir este roteiro?</h2>
            <p className="muted">
              O roteiro de “{productName}” e o progresso deste conteúdo serão removidos. O produto continua no catálogo.
              Essa ação não pode ser desfeita.
            </p>
            <div className="tt-rail-dialog-actions">
              <button className="danger-button" type="button" disabled={deleting} onClick={() => void confirmDeleteKit()}>
                {deleting ? "Excluindo..." : "Excluir roteiro"}
              </button>
              <button className="ghost" type="button" disabled={deleting} onClick={() => setConfirmDelete(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
