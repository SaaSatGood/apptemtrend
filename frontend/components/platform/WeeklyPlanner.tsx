"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import { api, friendlyError, type ApiError } from "@/lib/api";
import { displayProductName } from "@/lib/format";
import { resolveSession } from "@/lib/supabase";
import { notifyPlanUsageChanged } from "@/lib/usage-events";
import type { BillingSubscriptionSummary, CreatorContent, Product } from "@/lib/types";
import { usePlatform } from "./store";

const WEEKDAY = new Intl.DateTimeFormat("pt-BR", { weekday: "long" });

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Gera o kit tolerando rajada: 429/503 ganham backoff antes de desistir. */
async function createKitWithRetry(productId: string, token: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await api(`/products/${productId}/content-kit`, token, {
        method: "POST",
        body: JSON.stringify({ force_new: false }),
        timeoutMs: 90_000,
      });
    } catch (error) {
      lastError = error;
      const status = (error as ApiError).status;
      if (status !== 429 && status !== 503) throw error;
      await wait(2_000 * (attempt + 1));
    }
  }
  throw lastError;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function nextMonday() {
  const now = new Date();
  const offset = (8 - now.getDay()) % 7;
  return dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset));
}

function dayAt(start: string, offset: number) {
  const [year, month, day] = start.split("-").map(Number);
  return new Date(year, month - 1, day + offset);
}

function dayLabel(date: Date) {
  const label = WEEKDAY.format(date).replace("-feira", "");
  return label.charAt(0).toLocaleUpperCase("pt-BR") + label.slice(1);
}

function distinctProducts(items: Product[]) {
  return Array.from(new Map(items.filter((item) => item?.id).map((item) => [item.id, item])).values());
}

export default function WeeklyPlanner({ results, onClose }: { results: Product[]; onClose: () => void }) {
  const { me, productions, loadProductions } = usePlatform();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [start, setStart] = useState(nextMonday);
  const [selected, setSelected] = useState<string[]>(() => Array.from({ length: 7 }, (_, index) => results[index]?.id ?? ""));
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState("");
  const [outcome, setOutcome] = useState("");
  const [limitReached, setLimitReached] = useState(false);
  const [subscription, setSubscription] = useState<BillingSubscriptionSummary | null>(null);

  const products = useMemo(
    () => distinctProducts([...results, ...productions.map((item) => item.products).filter((item): item is Product => Boolean(item)), ...catalog]),
    [results, productions, catalog]
  );
  const selectedCount = selected.filter(Boolean).length;
  const freePlan = (subscription?.plan ?? me?.creator?.plan ?? "free") === "free";
  const itemLimit = subscription?.limits?.productionItems ?? (freePlan ? 1 : null);
  const availableItems = itemLimit === null ? null : Math.max(0, itemLimit - productions.length);
  const existingChoices = selected.filter((id) => productions.some((item) => item.product_id === id)).length;
  const creatableChoices = availableItems === null
    ? selectedCount - existingChoices
    : Math.min(selectedCount - existingChoices, availableItems);
  const preparableCount = existingChoices + creatableChoices;

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (trigger?.isConnected) queueMicrotask(() => trigger.focus());
    };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const session = await resolveSession();
        if (!session) throw new Error("Entre na sua conta para planejar a semana.");
        const [first, billing] = await Promise.all([
          api<Product[]>("/products?page=1&limit=50", session.access_token),
          api<BillingSubscriptionSummary>("/billing/subscription", session.access_token).catch(() => null),
        ]);
        const second = first.length === 50
          ? await api<Product[]>("/products?page=2&limit=50", session.access_token)
          : [];
        if (!active) return;
        const reusable = productions
          .filter((item) => item.status !== "publicado")
          .map((item) => item.products)
          .filter((item): item is Product => Boolean(item));
        const list = distinctProducts([...results, ...reusable, ...first, ...second]);
        setCatalog([...first, ...second]);
        setSubscription(billing);
        setSelected((current) => {
          const used = new Set(current.filter(Boolean));
          return current.map((id) => {
            if (id) return id;
            const next = list.find((product) => !used.has(product.id));
            if (!next) return "";
            used.add(next.id);
            return next.id;
          });
        });
      } catch (error) {
        if (active) setLoadError(friendlyError(error, "Não conseguimos carregar o catálogo."));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [results, productions]);

  async function createWeek() {
    if (working || selectedCount === 0) return;
    setWorking(true);
    setOutcome("");
    setLimitReached(false);
    let completed = 0;
    let skipped = 0;
    let created = 0;
    let failure = "";
    const existing = new Map(productions.map((item) => [item.product_id, item]));
    try {
      const session = await resolveSession();
      if (!session) throw new Error("Entre na sua conta para planejar a semana.");
      for (let index = 0; index < selected.length; index++) {
        const productId = selected[index];
        if (!productId) continue;
        const plannedDate = dayAt(start, index);
        const date = dateKey(plannedDate);
        const weekday = dayLabel(plannedDate);
        const prior = existing.get(productId);
        if (prior?.scheduled_for === date && prior.content_kit_id) {
          completed++;
          continue;
        }
        if (!prior && availableItems !== null && created >= availableItems) {
          skipped++;
          continue;
        }
        setProgress(`Preparando ${weekday.toLocaleLowerCase("pt-BR")} (${index + 1}/7)…`);
        try {
          if (!prior?.content_kit_id) {
            await createKitWithRetry(productId, session.access_token);
          }
          const content = prior?.content_kit_id
            ? prior
            : await api<CreatorContent>("/creator-content", session.access_token, {
                method: "POST",
                body: JSON.stringify({ product_id: productId }),
              });
          if (!prior) created++;
          await api(`/creator-content/${content.id}`, session.access_token, {
            method: "PATCH",
            body: JSON.stringify({ scheduled_for: date }),
          });
          existing.set(productId, { ...content, scheduled_for: date });
          completed++;
        } catch (error) {
          failure = friendlyError(error, `Não conseguimos preparar ${weekday.toLocaleLowerCase("pt-BR")}.`);
          setLimitReached((error as ApiError).code === "PLAN_LIMIT");
          break;
        }
      }
      await loadProductions();
      notifyPlanUsageChanged();
      setOutcome(`${completed} ${completed === 1 ? "dia preparado" : "dias preparados"}${skipped ? `; ${skipped} aguardando espaço no plano` : ""}.${failure ? ` ${failure}` : ""}`);
    } catch (error) {
      setOutcome(friendlyError(error, "Não conseguimos concluir o planejamento. Tente novamente."));
    } finally {
      setProgress("");
      setWorking(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="tt-weekly-dialog"
      aria-modal="true"
      aria-labelledby="tt-weekly-title"
      onCancel={(event) => { if (working) event.preventDefault(); else onClose(); }}
    >
      <div className="tt-weekly-head">
        <div>
          <span className="tt-badge-chip">Planejamento editorial</span>
          <h2 id="tt-weekly-title">Sua semana de conteúdo</h2>
          <p>Escolha um produto por dia. O roteiro é preparado e a data aparece no calendário.</p>
        </div>
        <button type="button" aria-label="Fechar planejamento" disabled={working} onClick={onClose}><Icon name="x" size={18} /></button>
      </div>
      <div className="tt-weekly-start">
        <label htmlFor="tt-weekly-date">Começar em</label>
        <input id="tt-weekly-date" name="weekly-start-date" type="date" min={dateKey(new Date())} value={start} disabled={working} onChange={(event) => { if (event.target.value) setStart(event.target.value); }} />
        <span>Sete dias consecutivos</span>
      </div>
      {loading && <p className="tt-weekly-message" role="status">Buscando produtos do catálogo…</p>}
      {loadError && <p className="tt-weekly-message" role="alert">{loadError} Você ainda pode usar os produtos desta busca.</p>}
      <div className="tt-weekly-days">
        {Array.from({ length: 7 }, (_, index) => {
          const product = products.find((item) => item.id === selected[index]);
          const production = productions.find((item) => item.product_id === product?.id);
          const date = dayAt(start, index);
          const day = dayLabel(date);
          return (
            <div key={day} className="tt-weekly-day">
              <div className="tt-weekly-day-label"><strong>{day}</strong><span>{new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(date)}</span></div>
              <label>
                <span className="sr-only">Produto para {day}</span>
                <select name={`weekly-product-${index + 1}`} value={selected[index]} disabled={working} onChange={(event) => setSelected((current) => current.map((id, slot) => slot === index ? event.target.value : id))}>
                  <option value="">Escolher produto</option>
                  {products.map((item) => <option key={item.id} value={item.id} disabled={selected.some((id, slot) => slot !== index && id === item.id)}>{displayProductName(item)}</option>)}
                </select>
              </label>
              <small>{production?.scheduled_for === dateKey(date) ? "Já agendado" : production?.content_kit_id ? "Roteiro pronto" : product ? "Novo roteiro" : "Sem produto"}</small>
            </div>
          );
        })}
      </div>
      {itemLimit !== null && <p className="tt-weekly-limit">Seu plano comporta {itemLimit} conteúdos na produção. Você tem {availableItems} {availableItems === 1 ? "vaga" : "vagas"} para novos produtos; os já salvos podem ser agendados.</p>}
      {progress && <p className="tt-weekly-message" role="status">{progress}</p>}
      {outcome && <p className="tt-weekly-message" role="status">{outcome}</p>}
      {limitReached && <p className="tt-weekly-message"><Link href="/conta/planos">Ver planos e limites</Link></p>}
      <div className="tt-weekly-actions">
        <button type="button" className="tt-btn-outline" disabled={working} onClick={onClose}>Fechar</button>
        <button type="button" className="tt-btn-lime" disabled={working || !preparableCount || !start} onClick={() => void createWeek()}>
          <Icon name="calendar" size={16} />{working ? "Preparando semana…" : `Preparar ${preparableCount} ${preparableCount === 1 ? "dia" : "dias"}`}
        </button>
      </div>
    </dialog>
  );
}
