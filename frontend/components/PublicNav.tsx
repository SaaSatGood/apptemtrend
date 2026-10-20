"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { resolveSession } from "@/lib/supabase";

type PublicNavProps = { page: "home" | "pricing" | "legal" };

const links = [
  { label: "Como funciona", href: "/#como-funciona" },
  { label: "Plano de gravação", href: "/#content-kits" },
  { label: "Produtos", href: "/#produtos" },
  { label: "Planos", href: "/planos" },
  { label: "Dúvidas", href: "/#faq" },
];

export default function PublicNav({ page }: PublicNavProps) {
  const [open, setOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let active = true;
    void resolveSession().then((session) => {
      if (active) setLoggedIn(Boolean(session));
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header ref={headerRef} className="tt-public-header">
      <nav className="tt-public-nav" aria-label="Navegação principal">
        <Link className="tt-public-brand" href={page === "home" ? "#top" : "/"} aria-label="TemTrend, início">
          <span aria-hidden="true" />
          <strong>TemTrend</strong>
        </Link>
        <div className={`tt-public-links${open ? " is-open" : ""}`} id="tt-public-links">
          {links.map((link) => (
            <Link
              key={link.href}
              href={page === "home" ? (link.href === "/planos" ? "#planos" : link.href.replace(/^\/(#)/, "$1")) : link.href}
              aria-current={page === "pricing" && link.href === "/planos" ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          {loggedIn ? (
            <Link className="tt-public-app-link" href="/app" onClick={() => setOpen(false)}>Ir para o app</Link>
          ) : (
            <Link className="tt-public-mobile-account" href="/app" onClick={() => setOpen(false)}>Entrar</Link>
          )}
        </div>
        <div className="tt-public-actions">
          {!loggedIn && <Link className="tt-public-login" href="/app">Entrar</Link>}
          <Link className="tt-public-cta" href={loggedIn ? "/app/conta" : "/app?mode=signup"}>
            {loggedIn ? (page === "pricing" ? "Minha assinatura" : "Minha conta") : "Criar conta grátis"}
          </Link>
          <button
            ref={buttonRef}
            className="tt-public-menu-button"
            type="button"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            aria-expanded={open}
            aria-controls="tt-public-links"
            onClick={() => setOpen((current) => !current)}
          >
            <span className="tt-public-menu-icon" aria-hidden="true"><i /><i /></span>
          </button>
        </div>
      </nav>
    </header>
  );
}
