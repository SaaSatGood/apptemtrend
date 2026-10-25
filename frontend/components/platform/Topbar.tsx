"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Icon, { type IconName } from "@/components/ui/Icon";
import AppSidebar from "./AppSidebar";
import { usePlatform } from "./store";
import PlanBanner from "./PlanBanner";
import NotificationCenter from "./NotificationCenter";
import ThemeToggle from "./ThemeToggle";
import UserMenu from "./UserMenu";

function isKitDetail(pathname: string | null) {
  return pathname?.startsWith("/app/produtos") === true && pathname.includes("/kits/");
}

function sectionLabel(pathname: string | null): string {
  if (pathname?.startsWith("/app/descobrir")) return "Descobrir";
  if (pathname?.startsWith("/app/producao")) return "Minha produção";
  if (pathname?.startsWith("/app/produtos")) return isKitDetail(pathname) ? "Roteiro" : "Produto";
  if (pathname?.startsWith("/app/conta")) return "Minha conta";
  if (pathname?.startsWith("/app/suporte")) return "Suporte";
  if (pathname === "/planos") return "Planos";
  return "Dashboard";
}

function sectionIcon(pathname: string | null): IconName {
  if (pathname?.startsWith("/app/descobrir")) return "search";
  if (pathname?.startsWith("/app/producao")) return "production";
  if (pathname?.startsWith("/app/produtos")) return isKitDetail(pathname) ? "file-text" : "box";
  if (pathname?.startsWith("/app/conta")) return "user";
  if (pathname?.startsWith("/app/suporte")) return "support";
  if (pathname === "/planos") return "plan";
  return "dashboard";
}

export default function Topbar() {
  const { me } = usePlatform();
  const pathname = usePathname();
  const admin = me?.is_admin === true;
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 16);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  const isDashboard = pathname === "/app";

  return (
    <>
      {!admin && <AppSidebar />}
      <header className={`topbar${admin ? " is-admin" : ""}${scrolled ? " is-scrolled" : ""}`}>
        <a className="app-skip-link" href="#page-content">Pular para o conteúdo</a>
        <Link className="app-logo" href="/app" aria-label="TemTrend, painel">
          <span aria-hidden="true">T</span><b>TemTrend</b>
        </Link>

        {!admin && (
          <div className="tt-topbar-crumb">
            <span className="tt-topbar-crumb-icon"><Icon name={sectionIcon(pathname)} size={16} /></span>
            <strong>{sectionLabel(pathname)}</strong>
          </div>
        )}

        {!admin && (
          <nav className="app-nav" aria-label="Navegação da plataforma">
            <Link
              href="/app/descobrir"
              aria-current={pathname?.startsWith("/app/descobrir") || pathname?.startsWith("/app/produtos") ? "page" : undefined}
              className={pathname?.startsWith("/app/descobrir") || pathname?.startsWith("/app/produtos") ? "active" : ""}
            >
              Descobrir
            </Link>
            <Link
              href="/app"
              aria-current={isDashboard ? "page" : undefined}
              className={isDashboard ? "active" : ""}
            >
              Dashboard
            </Link>
            <Link
              href="/app/producao"
              aria-current={pathname?.startsWith("/app/producao") ? "page" : undefined}
              className={pathname?.startsWith("/app/producao") ? "active" : ""}
            >
              Produção
            </Link>
            <Link
              href="/app/conta"
              aria-current={pathname?.startsWith("/app/conta") ? "page" : undefined}
              className={pathname?.startsWith("/app/conta") ? "active" : ""}
            >
              Conta
            </Link>
          </nav>
        )}

        <div className="tt-topbar-actions">
          {!admin && <ThemeToggle />}
          {!admin && <NotificationCenter />}
          {admin && <span className="admin-nav-label">Painel administrativo</span>}
          {/* No desktop o menu da conta vive na sidebar; no celular, aqui. */}
          <UserMenu variant="topbar" />
        </div>
      </header>
      {!admin && <PlanBanner />}
    </>
  );
}
