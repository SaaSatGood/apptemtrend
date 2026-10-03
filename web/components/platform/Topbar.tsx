"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePlatform } from "./store";

export default function Topbar() {
  const { me, signOut } = usePlatform();
  const pathname = usePathname();
  const admin = me?.is_admin === true;

  return (
    <header className="topbar">
      <Link className="app-logo" href="/app" aria-label="TemTrend, início">
        <span>T</span>TEMTREND
      </Link>
      {!admin && (
        <nav className="app-nav" aria-label="Navegação da plataforma">
          <Link
            href="/app"
            aria-current={pathname === "/app" ? "page" : undefined}
            className={pathname === "/app" ? "active" : ""}
          >
            Descobrir
          </Link>
          <Link
            href="/app/producao"
            aria-current={pathname?.startsWith("/app/producao") ? "page" : undefined}
            className={pathname?.startsWith("/app/producao") ? "active" : ""}
          >
            Minha produção
          </Link>
        </nav>
      )}
      <UserMenu onSignOut={() => void signOut()} />
    </header>
  );
}

function UserMenu({ onSignOut }: { onSignOut: () => void }) {
  const { session } = usePlatform();
  const meta = (session?.user.user_metadata ?? {}) as { full_name?: string; name?: string };
  const display = meta.full_name ?? meta.name ?? session?.user.email?.split("@")[0] ?? "Minha conta";
  return (
    <details className="user-menu">
      <summary aria-label="Abrir menu da conta">
        <span className="user-copy">
          <strong>{display}</strong>
          <small>{session?.user.email || ""}</small>
        </span>
        <span className="user-avatar">{display.trim().charAt(0).toUpperCase() || "T"}</span>
      </summary>
      <div className="user-menu-panel">
        <Link href="/app/conta">Configurações</Link>
        <button type="button" onClick={onSignOut}>
          Sair
        </button>
      </div>
    </details>
  );
}
