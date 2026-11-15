"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";

const THEME_KEY = "temtrend_theme";

export type ThemeMode = "light" | "dark";

function readInitialTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  try {
    const saved = window.localStorage.getItem(THEME_KEY);
    if (saved === "dark" || saved === "light") return saved;
  } catch { /* preferencia opcional */ }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: ThemeMode) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  try { window.localStorage.setItem(THEME_KEY, theme); } catch { /* preferencia opcional */ }
}

/** Script injetado antes da hidratação para evitar flash de tema. */
export const themeBootstrapScript = `(function(){try{var s=localStorage.getItem("${THEME_KEY}");var t=(s==="dark"||s==="light")?s:(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.dataset.theme=t;}catch(e){}})();`;

/** Alterna o modo noturno em toda a plataforma. */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>("light");

  useEffect(() => {
    const initial = readInitialTheme();
    queueMicrotask(() => {
      setTheme(initial);
      applyTheme(initial);
    });
  }, []);

  function toggle() {
    const next: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  const dark = theme === "dark";

  return (
    <button
      type="button"
      className="tt-theme-toggle"
      aria-label={dark ? "Ativar modo claro" : "Ativar modo noturno"}
      aria-pressed={dark}
      title={dark ? "Modo claro" : "Modo noturno"}
      onClick={toggle}
    >
      <Icon name={dark ? "sun" : "moon"} size={21} />
    </button>
  );
}
