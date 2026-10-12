"use client";

import { useEffect, useRef, useState } from "react";

export default function LandingMenu() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const links = document.getElementById("nav-links");
    links?.classList.toggle("open", open);
    const closeOnLink = (event: MouseEvent) => {
      if ((event.target as HTMLElement).closest("a")) setOpen(false);
    };
    links?.addEventListener("click", closeOnLink);
    return () => links?.removeEventListener("click", closeOnLink);
  }, [open]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const closeOutside = (event: PointerEvent) => {
      if (!(event.target as HTMLElement).closest(".tt-header")) setOpen(false);
    };
    const closeOnDesktop = () => {
      if (window.innerWidth > 980) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", closeOutside);
    window.addEventListener("resize", closeOnDesktop);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("resize", closeOnDesktop);
    };
  }, []);

  return (
    <button
      ref={buttonRef}
      className="menu-button"
      aria-label={open ? "Fechar menu" : "Abrir menu"}
      aria-expanded={open}
      aria-controls="nav-links"
      type="button"
      onClick={() => setOpen((v) => !v)}
    >
      <span className="tt-menu-icon" aria-hidden="true"><i /><i /></span>
    </button>
  );
}
