"use client";

import { useEffect } from "react";

/**
 * Warmup best-effort do backend: dispara GET /health ao abrir a landing
 * para absorver o cold start antes do usuário chegar ao login.
 * Nunca segura renderização nem mostra erro.
 */
export default function ApiWarmup() {
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    (async () => {
      try {
        const { requireApiUrl } = await import("@/lib/config");
        await fetch(requireApiUrl() + "/health", { signal: controller.signal, cache: "no-store" });
      } catch {
        /* warmup é best-effort */
      } finally {
        clearTimeout(timer);
      }
    })();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, []);
  return null;
}
