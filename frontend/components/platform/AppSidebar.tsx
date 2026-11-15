"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import Icon, { type IconName } from "@/components/ui/Icon";
import { api } from "@/lib/api";
import { displaySessionTitle } from "@/lib/session-title";
import { SESSIONS_CHANGED_EVENT, notifySessionsChanged } from "@/lib/session-events";
import { forgetDiscoverySession, peekDiscoverySession, prefetchDiscoverySession, rememberDiscoverySession } from "@/lib/discovery-session-cache";
import { resolveSession } from "@/lib/supabase";
import { hasPaidPlan } from "@/lib/plan-access";
import type { DiscoverySessionSummary } from "@/lib/types";
import Modal from "./Modal";
import PlanUsageCard from "./PlanUsageCard";
import { usePlatform } from "./store";
import UserMenu from "./UserMenu";

type RailItem = {
  href: string;
  label: string;
  icon: IconName;
};

const RAIL_ITEMS: RailItem[] = [
  { href: "/produtos", label: "Produtos", icon: "box" },
  { href: "/conteudos", label: "Meus conteúdos", icon: "video" },
  { href: "/producao", label: "Produção", icon: "layers" },
  { href: "/calendario", label: "Calendário", icon: "calendar" },
  { href: "/resultados", label: "Resultados", icon: "pie-chart" },
  { href: "/conta/planos", label: "Planos", icon: "plan" },
  { href: "/preferencias", label: "Preferências", icon: "settings" },
];

const HISTORY_LIMIT = 8;

const COLLAPSE_KEY = "temtrend_rail_collapsed";

export default function AppSidebar() {
  const pathname = usePathname() || "/descobrir";
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [sessions, setSessions] = useState<DiscoverySessionSummary[]>([]);
  const [pinnedSessionIds, setPinnedSessionIds] = useState<string[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [openHistoryMenuId, setOpenHistoryMenuId] = useState<string | null>(null);
  const [historyMenuPosition, setHistoryMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DiscoverySessionSummary | null>(null);
  const [pendingRename, setPendingRename] = useState<DiscoverySessionSummary | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const { toast, me } = usePlatform();

  // Cada clique em Descobrir abre uma tela inicial nova, mesmo se já estiver nela.
  function startNewChat(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    router.push(`/descobrir?nova=${Date.now()}`);
  }

  useEffect(() => {
    let active = true;
    try {
      const saved = localStorage.getItem(COLLAPSE_KEY) === "1";
      if (saved) queueMicrotask(() => { if (active) setCollapsed(true); });
    } catch { /* preferencia opcional */ }
    return () => { active = false; };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.rail = collapsed ? "collapsed" : "expanded";
    try { localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0"); } catch { /* preferencia opcional */ }
  }, [collapsed]);

  /** Recarrega o histórico: conversar no Descobrir cria/atualiza sessões. */
  const refreshSessions = useCallback(async () => {
    try {
      const session = await resolveSession();
      if (!session?.access_token) {
        setSessionsLoading(false);
        return;
      }
      const result = await api<{ items: DiscoverySessionSummary[] }>(
        "/assistant/sessions",
        session.access_token,
      );
      setSessions(Array.isArray(result.items) ? result.items : []);
    } catch {
      // Histórico é um extra: a sidebar continua sem a lista.
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => { void refreshSessions(); });
  }, [pathname, refreshSessions]);

  // A conversa nova muda só a URL (replaceState): o evento mantém a lista viva.
  useEffect(() => {
    const refresh = () => { void refreshSessions(); };
    window.addEventListener(SESSIONS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(SESSIONS_CHANGED_EVENT, refresh);
  }, [refreshSessions]);

  useEffect(() => {
    if (!openHistoryMenuId) return;
    const close = (event: PointerEvent) => {
      if (!(event.target as HTMLElement).closest(".tt-rail-history-menu, .tt-rail-history-menu-popover")) setOpenHistoryMenuId(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [openHistoryMenuId]);

  const isKitDetail = pathname.startsWith("/produtos") && pathname.includes("/kits/");
  const isProducts = pathname.startsWith("/produtos") && !isKitDetail;
  const isDiscover = pathname.startsWith("/descobrir");
  const isContents = pathname.startsWith("/conteudos") || isKitDetail;

  const history = sessions;
  const productsLocked = !me?.is_admin && !hasPaidPlan(me?.creator);
  const railItems = RAIL_ITEMS;
  const visibleHistory = useMemo(() => {
    const pinned = history.filter((item) => pinnedSessionIds.includes(item.id));
    const rest = history.filter((item) => !pinnedSessionIds.includes(item.id));
    return [...pinned, ...rest].slice(0, HISTORY_LIMIT);
  }, [history, pinnedSessionIds]);

  // Pré-carrega as conversas mais recentes no ócio: o clique no histórico já
  // encontra os turnos em cache e entra direto no chat.
  useEffect(() => {
    if (!visibleHistory.length) return;
    const timer = window.setTimeout(() => {
      for (const item of visibleHistory.slice(0, 3)) {
        prefetchDiscoverySession(me?.user_id, item.id);
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [visibleHistory, me?.user_id]);

  function closeItemMenu(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    setOpenHistoryMenuId(null);
    setHistoryMenuPosition(null);
  }

  function renameSession(item: DiscoverySessionSummary, event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    closeItemMenu(event);
    setRenameValue(displaySessionTitle(item.title, item.created_at));
    setPendingRename(item);
  }

  function togglePinSession(item: DiscoverySessionSummary, event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    setPinnedSessionIds((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [item.id, ...current]);
    closeItemMenu(event);
  }

  function deleteSession(item: DiscoverySessionSummary, event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    closeItemMenu(event);
    setPendingDelete(item);
  }

  async function confirmRename() {
    const item = pendingRename;
    const nextTitle = renameValue.trim();
    if (!item || actionBusy) return;
    if (!nextTitle || nextTitle === item.title) { setPendingRename(null); return; }
    const previous = sessions;
    setActionBusy(true);
    setSessions((current) => current.map((session) => session.id === item.id ? { ...session, title: nextTitle } : session));
    try {
      const resolved = await resolveSession();
      if (!resolved?.access_token) throw new Error("sem sessão");
      await api(`/assistant/sessions/${item.id}`, resolved.access_token, {
        method: "PATCH",
        body: JSON.stringify({ title: nextTitle }),
      });
      const cached = peekDiscoverySession(me?.user_id, item.id);
      if (cached) rememberDiscoverySession(me?.user_id, { ...cached, title: nextTitle });
      setPendingRename(null);
      notifySessionsChanged();
      toast("Conversa renomeada.");
    } catch {
      setSessions(previous);
      toast("Não foi possível renomear a conversa. Tente novamente.");
    } finally {
      setActionBusy(false);
    }
  }

  async function confirmDelete() {
    const item = pendingDelete;
    if (!item || actionBusy) return;
    const previous = sessions;
    const wasPinned = pinnedSessionIds.includes(item.id);
    setActionBusy(true);
    setSessions((current) => current.filter((session) => session.id !== item.id));
    setPinnedSessionIds((current) => current.filter((id) => id !== item.id));
    try {
      const resolved = await resolveSession();
      if (!resolved?.access_token) throw new Error("sem sessão");
      await api(`/assistant/sessions/${item.id}`, resolved.access_token, { method: "DELETE" });
      forgetDiscoverySession(me?.user_id, item.id);
      setPendingDelete(null);
      if (pathname === `/descobrir/${item.id}`) router.push("/descobrir");
      notifySessionsChanged();
      toast("Conversa excluída.");
    } catch {
      setSessions(previous);
      if (wasPinned) setPinnedSessionIds((current) => current.includes(item.id) ? current : [item.id, ...current]);
      toast("Não foi possível excluir a conversa. Tente novamente.");
    } finally {
      setActionBusy(false);
    }
  }

  function isActive(href: string): boolean {
    if (href === "/produtos") return isProducts;
    if (href === "/conteudos") return isContents;
    return pathname.startsWith(href);
  }

  return (
    <aside className={`tt-app-sidebar${collapsed ? " is-collapsed" : ""}`}>
      <div className="tt-rail-head">
        <Link className="tt-rail-brand" href="/descobrir" onClick={startNewChat} aria-label="TemTrend, descobrir">
          <span aria-hidden="true" />
          <strong>TemTrend</strong>
        </Link>
        <button
          type="button"
          className="tt-rail-collapse"
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
          onClick={() => setCollapsed((current) => !current)}
        >
          <Icon name="panel-left" size={20} />
        </button>
      </div>

      <nav className="tt-rail-nav" aria-label="Navegação principal">
        <Link
          href="/descobrir"
          onClick={startNewChat}
          className={`tt-rail-link tt-rail-link--primary${isDiscover ? " is-active" : ""}`}
          aria-current={isDiscover ? "page" : undefined}
          aria-label="Descobrir"
          title="Descobrir"
        >
          <Icon name="search" size={21} />
          <span>Descobrir</span>
        </Link>

        {railItems.map((item) => {
          const active = isActive(item.href);
          const locked = item.href === "/produtos" && productsLocked;
          const label = locked ? `${item.label} — exclusivo no Pro` : item.label;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`tt-rail-link${active ? " is-active" : ""}${locked ? " is-locked" : ""}`}
              aria-current={active ? "page" : undefined}
              aria-label={label}
              title={label}
            >
              <Icon name={item.icon} size={21} />
              <span>{item.label}</span>
              {locked && (
                <span className="tt-rail-lock" aria-hidden="true">
                  <Icon name="lock" size={11} />
                  Pro
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <section className="tt-rail-history" aria-label="Conversas do Descobrir">
        <div className="tt-rail-history-head">
          <span>Histórico</span>
          <Link
            href="/descobrir"
            onClick={startNewChat}
            className="tt-rail-history-add"
            aria-label="Nova conversa"
            title="Nova conversa"
          >
            <Icon name="plus" size={15} />
          </Link>
        </div>

        <div className="tt-rail-history-list">
          {sessionsLoading && sessions.length === 0 ? (
            <p className="tt-rail-history-empty">Carregando conversas…</p>
          ) : visibleHistory.length > 0 ? (
            visibleHistory.map((item) => {
              const title = displaySessionTitle(item.title, item.created_at);
              return (
              <div className={`tt-rail-history-row${pathname === `/descobrir/${item.id}` ? " is-current" : ""}`} key={item.id}>
                <Link
                  href={`/descobrir/${item.id}`}
                  className="tt-rail-history-item"
                  title={title}
                  aria-current={pathname === `/descobrir/${item.id}` ? "page" : undefined}
                  onMouseEnter={() => prefetchDiscoverySession(me?.user_id, item.id)}
                  onFocus={() => prefetchDiscoverySession(me?.user_id, item.id)}
                  onTouchStart={() => prefetchDiscoverySession(me?.user_id, item.id)}
                >
                  <span className="tt-rail-history-copy">
                    <strong>{title}</strong>
                  </span>
                  <Icon className="tt-rail-history-go" name="chevron-right" size={14} />
                </Link>
                <div className="tt-rail-history-menu">
                  <button
                    type="button"
                    className="tt-rail-history-menu-trigger"
                    aria-label={`Ações para ${title}`}
                    aria-expanded={openHistoryMenuId === item.id}
                    title="Mais ações"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (openHistoryMenuId === item.id) { setOpenHistoryMenuId(null); setHistoryMenuPosition(null); return; }
                      const rect = event.currentTarget.getBoundingClientRect();
                      setHistoryMenuPosition({ top: Math.max(12, rect.top - 192), left: Math.max(12, rect.right - 250) });
                      setOpenHistoryMenuId(item.id);
                    }}
                  ><Icon name="more-horizontal" size={18} /></button>
                  {openHistoryMenuId === item.id && <div className="tt-rail-history-menu-popover" role="menu" style={historyMenuPosition ? { position: "fixed", top: historyMenuPosition.top, left: historyMenuPosition.left, right: "auto", bottom: "auto" } : undefined}>
                    <div className="tt-rail-history-menu-heading">
                      <strong>{title}</strong>
                      <small>Conversa do Descobrir</small>
                    </div>
                    <button type="button" onClick={(event) => renameSession(item, event)}>Renomear</button>
                    <button type="button" onClick={(event) => togglePinSession(item, event)}>{pinnedSessionIds.includes(item.id) ? "Desafixar" : "Fixar"}</button>
                    <button type="button" className="is-danger" onClick={(event) => deleteSession(item, event)}>Excluir</button>
                  </div>}
                </div>
              </div>
              );
            })
          ) : (
            <p className="tt-rail-history-empty">
              Suas conversas do Descobrir aparecem aqui.
            </p>
          )}
        </div>

        {history.length > HISTORY_LIMIT && (
          <span className="tt-rail-history-all">
            {history.length} conversas
          </span>
        )}
      </section>

      <div className="tt-rail-foot">
        <PlanUsageCard />
        <UserMenu variant="sidebar" />
      </div>

      {pendingRename && (
        <Modal
          titleId="tt-rename-session-title"
          busy={actionBusy}
          onClose={() => { if (!actionBusy) setPendingRename(null); }}
        >
          <form
            className="stack"
            onSubmit={(event) => { event.preventDefault(); void confirmRename(); }}
          >
            <p className="eyebrow">Renomear conversa</p>
            <h2 id="tt-rename-session-title">Novo nome</h2>
            <label>
              Nome da conversa
              <input
                type="text"
                maxLength={120}
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                autoComplete="off"
              />
            </label>
            <div className="tt-rail-dialog-actions">
              <button className="primary" type="submit" disabled={actionBusy || !renameValue.trim()}>
                {actionBusy ? "Salvando..." : "Salvar nome"}
              </button>
              <button className="ghost" type="button" disabled={actionBusy} onClick={() => setPendingRename(null)}>
                Cancelar
              </button>
            </div>
          </form>
        </Modal>
      )}

      {pendingDelete && (
        <Modal
          titleId="tt-delete-session-title"
          busy={actionBusy}
          onClose={() => { if (!actionBusy) setPendingDelete(null); }}
        >
          <div className="stack">
            <p className="eyebrow">Excluir conversa</p>
            <h2 id="tt-delete-session-title">Excluir esta conversa?</h2>
            <p className="muted">
              “{displaySessionTitle(pendingDelete.title, pendingDelete.created_at)}” sai do seu histórico.
              Essa ação não pode ser desfeita.
            </p>
            <div className="tt-rail-dialog-actions">
              <button className="danger-button" type="button" disabled={actionBusy} onClick={() => void confirmDelete()}>
                {actionBusy ? "Excluindo..." : "Excluir conversa"}
              </button>
              <button className="ghost" type="button" disabled={actionBusy} onClick={() => setPendingDelete(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </aside>
  );
}
