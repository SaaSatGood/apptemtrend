"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import Icon from "@/components/ui/Icon";
import { usePlatform } from "./store";

/**
 * Menu da conta. No desktop ele vive no rodapé da barra lateral
 * (como no design de referência); no mobile fica no topo.
 */
export default function UserMenu({ variant = "topbar" }: { variant?: "topbar" | "sidebar" }) {
  const { session, admin, signOut } = usePlatform();
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const close = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) ref.current?.removeAttribute("open"); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && ref.current?.open) { ref.current.open = false; ref.current.querySelector("summary")?.focus(); } };
    document.addEventListener("pointerdown", close); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, []);

  const meta = (session?.user.user_metadata ?? {}) as { full_name?: string; name?: string };
  const display = meta.full_name ?? meta.name ?? session?.user.email?.split("@")[0] ?? "Minha conta";
  const email = session?.user.email || "";

  return (
    <details ref={ref} className={`user-menu user-menu--${variant}`}>
      <summary aria-label={variant === "sidebar" ? "Minha conta e sair" : "Abrir menu da conta"}>
        {variant === "sidebar" ? (
          <>
            <span className="user-avatar">{display.trim().charAt(0).toUpperCase() || "T"}</span>
            <span className="user-copy">
              <strong>{display}</strong>
              <small>{email}</small>
            </span>
            <span className="user-menu-chevron"><Icon name="chevron-down" size={14} strokeWidth={2} /></span>
          </>
        ) : (
          <>
            <span className="user-copy">
              <strong>{display}</strong>
              <small>{email}</small>
            </span>
            <span className="user-avatar">{display.trim().charAt(0).toUpperCase() || "T"}</span>
            <span className="user-menu-chevron"><Icon name="chevron-down" size={14} strokeWidth={2} /></span>
          </>
        )}
      </summary>
      <div className="user-menu-panel">
        <div className="user-menu-heading">
          <strong>{display}</strong>
          <small>{email}</small>
        </div>
        <Link href="/app/conta" onClick={() => ref.current?.removeAttribute("open")}>Minha conta</Link>
        {!admin && <Link href="/planos" onClick={() => ref.current?.removeAttribute("open")}>Planos e assinatura</Link>}
        {!admin && <Link href="/app/conta?preferencias=1" onClick={() => ref.current?.removeAttribute("open")}>Preferências</Link>}
        {!admin && <Link href="/app/suporte" onClick={() => ref.current?.removeAttribute("open")}>Suporte</Link>}
        <button type="button" onClick={() => void signOut()}>
          Sair
        </button>
      </div>
    </details>
  );
}
