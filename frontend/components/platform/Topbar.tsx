"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Icon, { type IconName } from "@/components/ui/Icon";
import { hasPaidPlan } from "@/lib/plan-access";
import AppSidebar from "./AppSidebar";
import { usePlatform } from "./store";
import PlanBanner from "./PlanBanner";
import NotificationCenter from "./NotificationCenter";
import ThemeToggle from "./ThemeToggle";
import UserMenu from "./UserMenu";

function isKitDetail(pathname: string | null) {
  return pathname?.startsWith("/produtos") === true && pathname.includes("/kits/");
}

function sectionLabel(pathname: string | null): string {
  if (pathname?.startsWith("/descobrir")) return "Descobrir";
  if (pathname?.startsWith("/conteudos")) return "Meus conteúdos";
  if (pathname?.startsWith("/resultados")) return "Resultados";
  if (pathname?.startsWith("/producao")) return "Produtos selecionados";
  if (pathname?.startsWith("/calendario")) return "Calendário";
  if (pathname?.startsWith("/produtos")) return isKitDetail(pathname) ? "Roteiro" : pathname === "/produtos" ? "Produtos" : "Produto";
  if (pathname?.startsWith("/conta/planos")) return "Planos";
  if (pathname?.startsWith("/conta")) return "Minha conta";
  if (pathname?.startsWith("/preferencias")) return "Preferências";
  if (pathname?.startsWith("/suporte")) return "Suporte";
  if (pathname === "/planos") return "Planos";
  return "Dashboard";
}

function sectionIcon(pathname: string | null): IconName {
  if (pathname?.startsWith("/descobrir")) return "search";
  if (pathname?.startsWith("/conteudos")) return "video";
  if (pathname?.startsWith("/resultados")) return "pie-chart";
  if (pathname?.startsWith("/producao")) return "production";
  if (pathname?.startsWith("/calendario")) return "calendar";
  if (pathname?.startsWith("/produtos")) return isKitDetail(pathname) ? "file-text" : "box";
  if (pathname?.startsWith("/conta/planos")) return "plan";
  if (pathname?.startsWith("/conta")) return "user";
  if (pathname?.startsWith("/preferencias")) return "settings";
  if (pathname?.startsWith("/suporte")) return "support";
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

  const isKit = isKitDetail(pathname);
  const isProducts = pathname?.startsWith("/produtos") === true && !isKit;
  const isDiscover = pathname?.startsWith("/descobrir") === true;
  const isContents = pathname?.startsWith("/conteudos") === true || isKit;
  const isPlans = pathname?.startsWith("/conta/planos") === true;
  const isAccount = pathname?.startsWith("/conta") === true && !isPlans;
  const showCatalog = hasPaidPlan(me?.creator);

  return (
    <>
      {!admin && <AppSidebar />}
      <header className={`topbar${admin ? " is-admin" : ""}${scrolled ? " is-scrolled" : ""}`}>
        <a className="app-skip-link" href="#page-content">Pular para o conteúdo</a>
        <Link className="app-logo" href="/descobrir" aria-label="TemTrend, descobrir">
          <span aria-hidden="true" /><b>TemTrend</b>
        </Link>

        {!admin && (
          <div className="tt-topbar-crumb">
            <span className="tt-topbar-crumb-icon"><Icon name={sectionIcon(pathname)} size={21} /></span>
            <strong>{sectionLabel(pathname)}</strong>
          </div>
        )}

        {!admin && (
          <nav className="app-nav" aria-label="Navegação da plataforma">
            <Link
              href="/descobrir"
              aria-current={isDiscover ? "page" : undefined}
              className={isDiscover ? "active" : ""}
            >
              Descobrir
            </Link>
            {showCatalog && (
              <Link
                href="/produtos"
                aria-current={isProducts ? "page" : undefined}
                className={isProducts ? "active" : ""}
              >
                Produtos
              </Link>
            )}
            <Link
              href="/conteudos"
              aria-current={isContents ? "page" : undefined}
              className={isContents ? "active" : ""}
            >
              Meus conteúdos
            </Link>
            <Link
              href="/resultados"
              aria-current={pathname?.startsWith("/resultados") ? "page" : undefined}
              className={pathname?.startsWith("/resultados") ? "active" : ""}
            >
              Resultados
            </Link>
            <Link
              href="/conta"
              aria-current={isAccount ? "page" : undefined}
              className={isAccount ? "active" : ""}
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
