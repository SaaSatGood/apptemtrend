"use client";

import { requireApiUrl } from "./config";
import { supabase } from "./supabase";

export type TrackProps = Record<string, string | number | boolean>;

const FIRST_SEEN_KEY = "temtrend_first_seen_at";

// Marca o primeiro contato (landing) para calcular o TTV: tempo até o
// primeiro kit gerado — a métrica de ativação que o funil precisa.
export function markFirstSeen() {
  try {
    if (!window.localStorage.getItem(FIRST_SEEN_KEY)) {
      window.localStorage.setItem(FIRST_SEEN_KEY, String(Date.now()));
    }
  } catch {
    /* armazenamento indisponível */
  }
}

export function ttvMs(): number | undefined {
  try {
    const raw = window.localStorage.getItem(FIRST_SEEN_KEY);
    if (!raw) return undefined;
    const started = Number(raw);
    if (!Number.isFinite(started) || started <= 0) return undefined;
    return Date.now() - started;
  } catch {
    return undefined;
  }
}

// Fire-and-forget: telemetria nunca bloqueia nem quebra o fluxo do usuário.
export function track(name: string, props?: TrackProps) {
  if (typeof window === "undefined") return;
  void (async () => {
    try {
      let token: string | undefined;
      try {
        const { data } = await supabase().auth.getSession();
        token = data.session?.access_token;
      } catch {
        /* sessão opcional: evento anônimo */
      }
      await fetch(requireApiUrl() + "/events", {
        method: "POST",
        keepalive: true,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name, props: props ?? {}, path: window.location.pathname }),
      });
    } catch {
      /* telemetria best-effort */
    }
  })();
}
