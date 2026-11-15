"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "@/components/ui/Icon";
import Modal from "./Modal";
import { api, friendlyError } from "@/lib/api";
import { resolveSession } from "@/lib/supabase";
import { fullProductName, shortProductName } from "@/lib/format";
import { notifyPlanUsageChanged } from "@/lib/usage-events";
import type { ContentKit, CreatorContent } from "@/lib/types";
import { usePlatform } from "./store";
import ProductImage from "./ProductImage";
import RecordingScript from "./RecordingScript";

type Tab = "para_gravar" | "gravado" | "publicado";
type Group = "late" | "today" | "week" | "later" | "none";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "para_gravar", label: "Para gravar" },
  { id: "gravado", label: "Gravados" },
  { id: "publicado", label: "Publicados" },
];

const GROUP_LABEL: Record<Group, string> = {
  late: "Atrasados",
  today: "Hoje",
  week: "Esta semana",
  later: "Mais tarde",
  none: "Sem data",
};
const GROUP_ORDER: Group[] = ["late", "today", "week", "later", "none"];

const STATUS_META: Record<string, { icon: "file-text" | "pencil" | "check-circle" | "video"; label: string }> = {
  salvo: { icon: "file-text", label: "Roteiro pronto" },
  em_producao: { icon: "pencil", label: "Em revisão" },
  gravado: { icon: "check-circle", label: "Gravado" },
  publicado: { icon: "check-circle", label: "Publicado" },
};

// Gancho padrão do catálogo: não é específico do produto, então não aparece na linha.
const GENERIC_HOOK = /quer ver este produto de perto|olha este produto de perto/i;

function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dayDiff(dateKey: string, todayKey: string): number {
  const ms = new Date(`${dateKey}T12:00:00`).getTime() - new Date(`${todayKey}T12:00:00`).getTime();
  return Math.round(ms / 86_400_000);
}

function shortDate(dateKey: string): string {
  const [, month, day] = dateKey.split("-");
  return `${day}/${month}`;
}

function weekday(dateKey: string): string {
  const label = new Intl.DateTimeFormat("pt-BR", { weekday: "short" })
    .format(new Date(`${dateKey}T12:00:00`))
    .replace(".", "");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function groupOf(item: CreatorContent, todayKey: string): Group {
  if (!item.scheduled_for) return "none";
  const diff = dayDiff(item.scheduled_for, todayKey);
  if (diff < 0) return "late";
  if (diff === 0) return "today";
  if (diff <= 7) return "week";
  return "later";
}

function dateChip(dateKey: string, todayKey: string): { label: string; tone: "late" | "today" | "plain" } {
  const diff = dayDiff(dateKey, todayKey);
  const base = `${weekday(dateKey)}, ${shortDate(dateKey)}`;
  if (diff === 0) return { label: `Hoje, ${shortDate(dateKey)}`, tone: "today" };
  if (diff < 0) return { label: `${base} · há ${-diff} ${-diff === 1 ? "dia" : "dias"}`, tone: "late" };
  return { label: base, tone: "plain" };
}

function sortByDate(a: CreatorContent, b: CreatorContent): number {
  return (a.scheduled_for ?? "9999-12-31").localeCompare(b.scheduled_for ?? "9999-12-31");
}

export default function ContentsView() {
  const { productions, loadProductions, toast } = usePlatform();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("para_gravar");
  const [search, setSearch] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [script, setScript] = useState<{ item: CreatorContent; kit: ContentKit } | null>(null);
  const todayKey = localDateKey();

  useEffect(() => {
    if (!menuId) return;
    const close = (event: PointerEvent) => {
      if (!(event.target as HTMLElement).closest(".ct-menu-wrap")) setMenuId(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuId(null);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuId]);

  const counts = useMemo(() => ({
    para_gravar: productions.filter((p) => p.status === "salvo" || p.status === "em_producao").length,
    gravado: productions.filter((p) => p.status === "gravado").length,
    publicado: productions.filter((p) => p.status === "publicado").length,
  }), [productions]);

  // "Comece por aqui": o primeiro roteiro atrasado, depois o de hoje, depois o próximo.
  const focus = useMemo(() => {
    const pending = productions
      .filter((p) => p.status === "salvo" || p.status === "em_producao")
      .sort(sortByDate);
    return pending.find((p) => groupOf(p, todayKey) === "late")
      ?? pending.find((p) => groupOf(p, todayKey) === "today")
      ?? pending[0]
      ?? null;
  }, [productions, todayKey]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return productions.filter((item) => {
      const inTab = tab === "para_gravar"
        ? item.status === "salvo" || item.status === "em_producao"
        : item.status === tab;
      if (!inTab) return false;
      if (!term) return true;
      const name = fullProductName(item.products ?? null).toLowerCase();
      const hook = (item.content_kits?.hook || "").toLowerCase();
      return name.includes(term) || hook.includes(term);
    });
  }, [productions, tab, search]);

  const groups = useMemo(() => {
    const byGroup = new Map<Group, CreatorContent[]>();
    for (const item of visible) {
      const group = groupOf(item, todayKey);
      byGroup.set(group, [...(byGroup.get(group) ?? []), item]);
    }
    return GROUP_ORDER.flatMap((group) => {
      const items = byGroup.get(group);
      if (!items?.length) return [];
      return [{ group, items: [...items].sort(sortByDate) }];
    });
  }, [visible, todayKey]);

  const focusGroup = focus ? groupOf(focus, todayKey) : null;
  const focusLine = focusGroup === "late" && focus?.scheduled_for
    ? `Comece por aqui · atrasado desde ${weekday(focus.scheduled_for).toLowerCase()}, ${shortDate(focus.scheduled_for)}`
    : focusGroup === "today"
      ? "Comece por aqui · para hoje"
      : "Comece por aqui";

  async function ensureKit(item: CreatorContent): Promise<ContentKit | null> {
    if (item.content_kits?.id) return item.content_kits;
    setBusyId(item.id);
    try {
      const resolved = await resolveSession();
      const kit = (await api<{ content_kit: ContentKit }>(`/products/${item.product_id}/content-kit`, resolved?.access_token, {
        method: "POST",
        body: JSON.stringify({ force_new: false }),
        timeoutMs: 90_000,
      })).content_kit;
      void loadProductions();
      notifyPlanUsageChanged();
      return kit;
    } catch (error) {
      toast(friendlyError(error, "Não conseguimos abrir o roteiro. Tente novamente."));
      return null;
    } finally {
      setBusyId(null);
    }
  }

  async function openRecording(item: CreatorContent) {
    if (busyId) return;
    setMenuId(null);
    const kit = await ensureKit(item);
    if (kit) router.push(`/produtos/${item.product_id}/kits/${kit.id}`);
  }

  async function openScript(item: CreatorContent) {
    if (busyId) return;
    setMenuId(null);
    const kit = await ensureKit(item);
    if (kit) router.push(`/produtos/${item.product_id}/kits/${kit.id}`);
  }

  function recordFromScript() {
    if (!script) return;
    router.push(`/produtos/${script.item.product_id}/kits/${script.kit.id}`);
    setScript(null);
  }

  function startEditDate(item: CreatorContent) {
    setMenuId(null);
    setEditingId(item.id);
    setEditDate(item.scheduled_for ?? "");
  }

  async function saveDate(item: CreatorContent) {
    setBusyId(item.id);
    try {
      const resolved = await resolveSession();
      await api(`/creator-content/${item.id}`, resolved?.access_token, {
        method: "PATCH",
        body: JSON.stringify({ scheduled_for: editDate || null }),
      });
      setEditingId(null);
      toast(editDate ? "Data atualizada." : "Data removida.");
      void loadProductions();
    } catch (error) {
      toast(friendlyError(error, "Não foi possível salvar a data."));
    } finally {
      setBusyId(null);
    }
  }

  async function removeContent(item: CreatorContent) {
    setMenuId(null);
    setBusyId(item.id);
    try {
      const resolved = await resolveSession();
      await api(`/creator-content/${item.id}`, resolved?.access_token, { method: "DELETE" });
      toast("Conteúdo removido.");
      void loadProductions();
    } catch (error) {
      toast(friendlyError(error, "Não foi possível remover este conteúdo."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="ct-page">
      <header className="ct-header">
        <h1>Meus <span className="tt-hl">conteúdos</span></h1>
        <div className="ct-header-actions">
          <Link className="ct-new" href="/calendario">Calendário</Link>
          <Link className="ct-new" href="/producao">Produção</Link>
          <Link
            href="/descobrir"
            className="ct-new is-primary"
            onClick={(event: MouseEvent<HTMLAnchorElement>) => {
              // Abre o Descobrir já em uma conversa nova, sem restaurar a anterior.
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
              event.preventDefault();
              router.push(`/descobrir?nova=${Date.now()}`);
            }}
          >+ Novo conteúdo</Link>
        </div>
      </header>

      {focus && (
        <div className="ct-focus">
          <span className="ct-focus-thumb">
            <ProductImage product={focus.products ?? { nome: "Produto selecionado" }} width={40} height={40} />
          </span>
          <div>
            <small>{focusLine}</small>
            <strong title={fullProductName(focus.products ?? null)}>{shortProductName(fullProductName(focus.products ?? null))}</strong>
          </div>
          <button type="button" className="ct-btn-record is-solid is-big" onClick={() => void openRecording(focus)} disabled={busyId === focus.id}>
            {busyId === focus.id ? "Abrindo…" : "Gravar agora"}
          </button>
        </div>
      )}

      <div className="ct-toolbar">
        <div className="ct-tabs" role="tablist" aria-label="Filtrar conteúdos">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={tab === item.id ? "is-active" : undefined}
              onClick={() => setTab(item.id)}
            >
              {item.label} <b>{counts[item.id]}</b>
            </button>
          ))}
        </div>
        <label className="ct-search">
          <Icon name="search" size={15} />
          <input
            type="search"
            name="content-search"
            autoComplete="off"
            aria-label="Buscar produto"
            placeholder="Buscar produto…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>

      {groups.length === 0 ? (
        <div className="ct-empty">
          <p>{search ? "Nenhum conteúdo encontrado para esta busca." : "Nenhum conteúdo nesta lista."}</p>
          <Link href="/descobrir">Descobrir produtos</Link>
        </div>
      ) : (
        groups.map(({ group, items }) => (
          <section key={group} className={`ct-group${items.some((item) => item.id === menuId) ? " is-menu-open" : ""}`}>
            <h2>{GROUP_LABEL[group]} <span>{items.length}</span></h2>
            <div className="ct-list">
              {items.map((item) => {
                const fullName = fullProductName(item.products ?? null);
                const name = shortProductName(fullName);
                const hook = item.content_kits?.hook;
                const specificHook = hook && !GENERIC_HOOK.test(hook) ? hook : null;
                const busy = busyId === item.id;
                const editing = editingId === item.id;
                const chip = item.scheduled_for ? dateChip(item.scheduled_for, todayKey) : null;
                const status = STATUS_META[item.status] ?? { icon: "file-text" as const, label: item.status };
                return (
                  <article key={item.id} className={`ct-row${focus?.id === item.id ? " is-featured" : ""}${menuId === item.id ? " is-menu-open" : ""}`}>
                    <button type="button" className="ct-row-open" onClick={() => void openScript(item)} aria-label={`Ver roteiro de ${name}`} title={fullName}>
                      <span className="ct-row-thumb">
                        <ProductImage product={item.products ?? { nome: "Produto selecionado" }} width={40} height={40} />
                      </span>
                      <span className="ct-row-copy">
                        <strong>{name}</strong>
                        {specificHook
                          ? <small className="ct-row-hook">“{specificHook}”</small>
                          : <small className={`ct-status is-${item.status}`}><Icon name={status.icon} size={12} /> {status.label}</small>}
                      </span>
                    </button>
                    <div className="ct-row-actions">
                      {editing ? (
                        <div className="ct-date-edit">
                          <input
                            type="date"
                            aria-label="Nova data"
                            value={editDate}
                            autoFocus
                            onFocus={(event) => { try { event.currentTarget.showPicker?.(); } catch { /* seletor opcional */ } }}
                            onChange={(event) => setEditDate(event.target.value)}
                          />
                          <button type="button" className="ct-btn-ghost" disabled={busy} onClick={() => void saveDate(item)}>Salvar</button>
                          <button type="button" className="ct-btn-ghost" onClick={() => setEditingId(null)}>Cancelar</button>
                        </div>
                      ) : chip ? (
                        <button type="button" className={`ct-date-chip is-${chip.tone}`} onClick={() => startEditDate(item)} title="Mudar data">
                          <Icon name="calendar" size={13} />
                          <span>{chip.label}</span>
                        </button>
                      ) : (
                        <button type="button" className="ct-date-chip is-empty" onClick={() => startEditDate(item)} title="Escolher data">
                          <Icon name="calendar" size={13} />
                          <span>Escolher data</span>
                        </button>
                      )}
                      <button type="button" className="ct-btn-record" disabled={busy} onClick={() => void openRecording(item)}>
                        {busy ? "Abrindo…" : "Gravar"}
                      </button>
                      <div className="ct-menu-wrap">
                        <button
                          type="button"
                          className="ct-menu-trigger"
                          aria-haspopup="menu"
                          aria-expanded={menuId === item.id}
                          aria-label={`Ações de ${name}`}
                          onClick={() => setMenuId(menuId === item.id ? null : item.id)}
                        >
                          <Icon name="more-horizontal" size={18} />
                        </button>
                        {menuId === item.id && (
                          <div className="ct-menu" role="menu">
                            <button type="button" role="menuitem" onClick={() => void openScript(item)}>Ver roteiro completo</button>
                            <button type="button" role="menuitem" onClick={() => startEditDate(item)}>Mudar data</button>
                            <button type="button" role="menuitem" className="is-danger" onClick={() => void removeContent(item)}>Remover</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))
      )}

      {script && (
        <Modal titleId="ct-script-title" onClose={() => setScript(null)} className="ct-drawer">
          <h2 id="ct-script-title" className="ct-drawer-title">{shortProductName(fullProductName(script.item.products ?? null))}</h2>
          <button className="dialog-close" type="button" aria-label="Fechar roteiro" onClick={() => setScript(null)}><Icon name="x" size={18} /></button>
          <RecordingScript kit={script.kit} readyLabel="Gravar" onReady={recordFromScript} />
        </Modal>
      )}

    </div>
  );
}
