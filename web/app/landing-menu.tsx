"use client";

import { useEffect, useState } from "react";

export default function LandingMenu() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.getElementById("nav-links")?.classList.toggle("open", open);
  }, [open ]);

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
      aria-label="Abrir menu"
      aria-expanded={open}
      aria-controls="nav-links"
      type="button"
      onClick={() => setOpen((v) => !v)}
    >
      ☰
    </button>
  );
}
