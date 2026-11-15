"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import Icon, { type IconName } from "@/components/ui/Icon";
import type { CreatorContent, MeResponse } from "@/lib/types";
import { usePlatform } from "./store";

type NotificationTone = "action" | "success" | "warning" | "neutral";

interface AppNotification {
  id: string;
  tone: NotificationTone;
  title: string;
  body: string;
  href: string;
  action: string;
  meta?: string;
}

const STATUS_PRIORITY: Record<CreatorContent["status"], number> = {
  gravado: 0,
  em_producao: 1,
  salvo: 2,
  publicado: 3,
};

function relativeTime(iso?: string | null): string {
  if (!iso) return "";
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) return "";
  const seconds = Math.round((timestamp - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
  if (Math.abs(seconds) < 60) return "agora";
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return formatter.format(days, "day");
  return new Date(timestamp).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function productionHref(item: CreatorContent): string {
  return item.content_kit_id
    ? `/produtos/${item.product_id}/kits/${item.content_kit_id}`
    : `/produtos/${item.product_id}`;
}

function buildNotifications(
  productions: CreatorContent[],
  me: MeResponse | null,
  productionsLoading: boolean
): AppNotification[] {
  const notifications: AppNotification[] = [];
  const creator = me?.creator;

  if (creator?.plan_status === "past_due") {
    notifications.push({
      id: `plan:past_due:${creator.current_period_end || ""}`,
      tone: "warning",
      title: "Pagamento pendente",
      body: "Atualize seu pagamento para manter o acesso e continuar criando.",
      href: "/conta",
      action: "Ver na conta",
      meta: "Requer atenção",
    });
  } else if (creator?.plan_status === "canceled" && creator.current_period_end) {
    notifications.push({
      id: `plan:canceled:${creator.current_period_end}`,
      tone: "warning",
      title: "Assinatura cancelada",
      body: "Seu acesso segue liberado até o fim do período atual.",
      href: "/conta/planos",
      action: "Reativar",
      meta: "Seu plano",
    });
  }

  const active = productions
    .filter((item) => item.status !== "publicado")
    .sort((a, b) => {
      const priority = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
      if (priority !== 0) return priority;
      return (b.atualizado_em || "").localeCompare(a.atualizado_em || "");
    })
    .slice(0, 4);

  active.forEach((item) => {
    const productName = item.products?.nome || "seu produto";
    const updated = relativeTime(item.atualizado_em);
    const meta = updated ? `Atualizado ${updated}` : "No seu fluxo";
    if (item.status === "gravado") {
      notifications.push({
        id: `content:${item.id}:${item.status}`,
        tone: "success",
        title: "Hora de publicar",
        body: `${productName} está gravado. Finalize a publicação quando estiver pronto.`,
        href: productionHref(item),
        action: "Publicar vídeo",
        meta,
      });
    } else if (item.status === "em_producao") {
      notifications.push({
        id: `content:${item.id}:${item.status}`,
        tone: "action",
        title: "Produção em andamento",
        body: `Retome a gravação de ${productName} de onde parou.`,
        href: productionHref(item),
        action: "Continuar gravação",
        meta,
      });
    } else {
      notifications.push({
        id: `content:${item.id}:${item.status}`,
        tone: "neutral",
        title: item.content_kit_id ? "Roteiro esperando você" : "Produto esperando você",
        body: item.content_kit_id
          ? `O roteiro de ${productName} está salvo. Revise e comece a gravar.`
          : `${productName} está salvo. Gere o roteiro para começar a gravar.`,
        href: productionHref(item),
        action: item.content_kit_id ? "Abrir roteiro" : "Ver produto",
        meta,
      });
    }
  });

  if (!productionsLoading && productions.length === 0 && me?.user_id) {
    notifications.push({
      id: `starter:${me.user_id}`,
      tone: "action",
      title: "Seu primeiro conteúdo começa aqui",
      body: "Encontre um produto no catálogo e gere seu primeiro roteiro com a TemTrend.",
      href: "/descobrir#assistant-section",
      action: "Explorar catálogo",
      meta: "Comece por aqui",
    });
  }

  return notifications;
}

const TONE_ICON: Record<NotificationTone, IconName> = {
  warning: "alert-triangle",
  success: "check-circle",
  action: "arrow-up-right",
  neutral: "bookmark",
};

function NotificationGlyph({ tone }: { tone: NotificationTone }) {
  return <Icon name={TONE_ICON[tone]} size={19} />;
}

function BellIcon() {
  return <Icon name="bell" size={21} />;
}

export default function NotificationCenter() {
  const { me, session, productions, productionsLoading } = usePlatform();
  const userId = session?.user?.id || "anon";
  const storageKey = `temtrend_notifications_read:${userId}`;
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<string[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const notifications = useMemo(
    () => buildNotifications(productions, me, productionsLoading),
    [productions, me, productionsLoading]
  );
  const unread = notifications.filter((item) => !readIds.includes(item.id)).length;
  const panelId = "tt-notifications-panel";

  useEffect(() => {
    let active = true;
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      const valid = Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
      queueMicrotask(() => { if (active) setReadIds(valid); });
    } catch {
      queueMicrotask(() => { if (active) setReadIds([]); });
    }
    return () => { active = false; };
  }, [storageKey]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function persistRead(next: string[]) {
    setReadIds(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* preferência opcional */ }
  }

  function markAllRead() {
    persistRead([...new Set([...readIds, ...notifications.map((item) => item.id)])]);
  }

  function markRead(id: string) {
    if (!readIds.includes(id)) persistRead([...readIds, id]);
    setOpen(false);
  }

  const buttonLabel = unread > 0
    ? `Abrir notificações, ${unread} não ${unread === 1 ? "lida" : "lidas"}`
    : "Abrir notificações";

  return (
    <div className="tt-notifications" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="tt-topbar-bell"
        aria-label={buttonLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        <BellIcon />
        {unread > 0 && <span className="tt-topbar-bell-count" aria-hidden="true">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div
          id={panelId}
          ref={panelRef}
          className="tt-notifications-panel"
          role="dialog"
          aria-label="Notificações"
          tabIndex={-1}
        >
          <header className="tt-notifications-head">
            <div>
              <h2>Notificações</h2>
              <span className={unread > 0 ? "has-unread" : ""}>
                {unread === 0 ? "Tudo em dia" : `${unread} ${unread === 1 ? "nova" : "novas"}`}
              </span>
            </div>
            <button type="button" className="tt-notifications-read-all" onClick={markAllRead} disabled={unread === 0}>
              Marcar como lidas
            </button>
          </header>

          {notifications.length > 0 ? (
            <div className="tt-notifications-list">
              {notifications.map((item) => {
                const isRead = readIds.includes(item.id);
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={`tt-notification${isRead ? " is-read" : ""}`}
                    onClick={() => markRead(item.id)}
                  >
                    <span className={`tt-notification-icon is-${item.tone}`} aria-hidden="true">
                      <NotificationGlyph tone={item.tone} />
                    </span>
                    <span className="tt-notification-copy">
                      <strong>{item.title}</strong>
                      <span>{item.body}</span>
                      <small>
                        {!isRead && <span className="sr-only">Não lida. </span>}
                        {!isRead && <i aria-hidden="true" />}
                        {item.meta || "Agora"}
                      </small>
                    </span>
                    <span className="tt-notification-action">{item.action} <Icon name="arrow-up-right" size={13} /></span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="tt-notifications-empty">
              <span><Icon name="check" size={18} /></span>
              <strong>Nada pendente por aqui.</strong>
              <p>Quando houver uma próxima ação no seu conteúdo, ela aparece neste espaço.</p>
              <Link href="/descobrir#assistant-section" onClick={() => setOpen(false)}>Encontrar um produto <Icon name="arrow-up-right" size={13} /></Link>
            </div>
          )}

          <footer className="tt-notifications-foot">
            <span>{notifications.length > 0 ? "Ações rápidas do seu fluxo" : "Seus produtos estão em dia"}</span>
            <Link href="/producao" onClick={() => setOpen(false)}>Ver produtos <Icon name="arrow-up-right" size={12} /></Link>
          </footer>
        </div>
      )}
    </div>
  );
}
