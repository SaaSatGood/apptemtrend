"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { usePlatform } from "./store";

export default function Topbar() {
  const { me, signOut } = usePlatform();
  const pathname = usePathname();
  const admin = me?.is_admin === true;
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 40);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <header className={`topbar${scrolled ? " is-scrolled" : ""}`}>
      <a className="app-skip-link" href="#page-content">Pular para conteúdo</a>
      <Link className="app-logo" href="/app" aria-label="TemTrend, início">
        <span aria-hidden="true">T</span><b>TemTrend</b>
      </Link>
      {!admin && (
        <nav className="app-nav" aria-label="Navegação da plataforma">
          <Link
            href="/app"
            aria-current={pathname === "/app" || pathname.startsWith("/app/produtos") ? "page" : undefined}
            className={pathname === "/app" || pathname.startsWith("/app/produtos") ? "active" : ""}
          >
            Descobrir
          </Link>
          <Link
            href="/app/producao"
            aria-current={pathname?.startsWith("/app/producao") ? "page" : undefined}
            className={pathname?.startsWith("/app/producao") ? "active" : ""}
          >
            Produção
          </Link>
        </nav>
      )}
      {admin && <span className="admin-nav-label">Painel administrativo</span>}
      {!admin && <Link className="app-create-link" href="/app#assistant-section"><span aria-hidden="true">+</span> Novo conteúdo</Link>}
      <UserMenu onSignOut={() => void signOut()} active={pathname?.startsWith("/app/conta") === true} />
    </header>
  );
}

function UserMenu({ onSignOut, active }: { onSignOut: () => void; active: boolean }) {
  const { session, admin } = usePlatform();
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) ref.current?.removeAttribute("open"); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && ref.current?.open) { ref.current.open = false; ref.current.querySelector("summary")?.focus(); } };
    document.addEventListener("pointerdown", close); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, []);
  const meta = (session?.user.user_metadata ?? {}) as { full_name?: string; name?: string };
  const display = meta.full_name ?? meta.name ?? session?.user.email?.split("@")[0] ?? "Minha conta";
  return (
    <details ref={ref} className={`user-menu${active ? " active" : ""}`}>
      <summary aria-label="Abrir menu da conta">
        <span className="user-copy">
          <strong>{display}</strong>
          <small>{session?.user.email || ""}</small>
        </span>
        <span className="user-avatar">{display.trim().charAt(0).toUpperCase() || "T"}</span>
        <span className="user-menu-chevron" aria-hidden="true">⌄</span>
      </summary>
      <div className="user-menu-panel">
        <div className="user-menu-heading">
          <strong>{display}</strong>
          <small>{session?.user.email || ""}</small>
        </div>
        <Link href="/app/conta" onClick={() => ref.current?.removeAttribute("open")}>Minha conta</Link>
        {!admin && <Link href="/app/conta?preferencias=1" onClick={() => ref.current?.removeAttribute("open")}>Preferências</Link>}
        <button type="button" onClick={onSignOut}>
          Sair
        </button>
      </div>
    </details>
  );
}
