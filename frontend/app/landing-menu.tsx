"use client";

import { useEffect, useState } from "react";

export default function LandingMenu() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const links = document.getElementById("nav-links");
    links?.classList.toggle("open", open);
    const close = () => setOpen(false);
    links?.addEventListener("click", close);
    return () => links?.removeEventListener("click", close);
  }, [open]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <button
      className="menu-button"
      aria-label={open ? "Fechar menu" : "Abrir menu"}
      aria-expanded={open}
      aria-controls="nav-links"
      type="button"
      onClick={() => setOpen((v) => !v)}
    >
      {open ? "×" : "☰"}
    </button>
  );
}
