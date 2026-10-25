"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Icon, { type IconName } from "@/components/ui/Icon";
import UserMenu from "./UserMenu";

type RailItem = {
  href: string;
  label: string;
  icon: IconName;
  match: (path: string) => boolean;
};

const RAIL_GROUPS: Array<{ id: string; label: string; items: RailItem[] }> = [
  {
    id: "conteudo",
    label: "Conteúdo",
    items: [
      { href: "/app", label: "Dashboard", icon: "dashboard", match: (path) => path === "/app" },
      { href: "/app/producao", label: "Minha produção", icon: "production", match: (path) => path.startsWith("/app/producao") },
    ],
  },
];

const COLLAPSE_KEY = "temtrend_rail_collapsed";

export default function AppSidebar() {
  const pathname = usePathname() || "/app";

  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ conteudo: true });

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

  function toggleGroup(id: string) {
    setOpenGroups((current) => ({ ...current, [id]: !current[id] }));
  }

  const isDiscover = pathname.startsWith("/app/descobrir") || pathname.startsWith("/app/produtos");

  return (
    <aside className={`tt-app-sidebar${collapsed ? " is-collapsed" : ""}`}>
      <div className="tt-rail-head">
        <Link className="tt-rail-brand" href="/app" aria-label="TemTrend, painel">
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
          <Icon name="panel-left" size={18} />
        </button>
      </div>

      <nav className="tt-rail-nav" aria-label="Navegação principal">
        <Link
          href="/app/descobrir"
          className={`tt-rail-link tt-rail-link--top${isDiscover ? " is-active" : ""}`}
          aria-current={isDiscover ? "page" : undefined}
          aria-label="Descobrir"
          title="Descobrir"
        >
          <Icon name="search" size={18} />
          <span>Descobrir</span>
        </Link>

        {RAIL_GROUPS.map((group) => {
          const open = openGroups[group.id] !== false;
          return (
            <div className="tt-rail-group" key={group.id}>
              <button
                type="button"
                className="tt-rail-group-toggle"
                aria-expanded={open}
                aria-controls={`tt-rail-group-${group.id}`}
                onClick={() => toggleGroup(group.id)}
              >
                {group.label}
                <span className="tt-rail-group-chevron" aria-hidden="true">
                  <Icon name="chevron-down" size={16} />
                </span>
              </button>
              {open && (
                <div className="tt-rail-group-items" id={`tt-rail-group-${group.id}`}>
                  {group.items.map((item) => {
                    const active = item.match(pathname);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`tt-rail-link${active ? " is-active" : ""}`}
                        aria-current={active ? "page" : undefined}
                        aria-label={item.label}
                        title={item.label}
                      >
                        <Icon name={item.icon} size={18} />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="tt-rail-foot">
        <UserMenu variant="sidebar" />
      </div>
    </aside>
  );
}
