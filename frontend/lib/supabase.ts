"use client";

import { GoTrueClient, type Session } from "@supabase/auth-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

export type { Session };

let client: GoTrueClient | null = null;

function storageKeyFor(url: string): string {
  // Formato idêntico ao do supabase-js (sb-<ref>-auth-token).
  // Mudar isso desloga todos os usuários; não alterar.
  try {
    return `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
  } catch {
    return "sb-auth-token";
  }
}

function getClient(): GoTrueClient {
  if (!client) {
    if (!SUPABASE_URL) {
      throw new Error("Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL no .env.local.");
    }
    client = new GoTrueClient({
      url: `${SUPABASE_URL.replace(/\/$/, "")}/auth/v1`,
      headers: { apikey: SUPABASE_ANON_KEY },
      storageKey: storageKeyFor(SUPABASE_URL),
      autoRefreshToken: true,
      // Sessão persistida (localStorage) com refresh automático: recarregar a
      // página ou voltar depois NÃO desloga e não reinicia o onboarding.
      // E2E injeta a sessão via window.__TT_E2E_SESSION__ e ignora o storage.
      persistSession: true,
      detectSessionInUrl: true,
    });
  }
  return client;
}

// Mesma forma de uso do supabase-js (só Auth é usado no app).
export function supabase(): { auth: GoTrueClient } {
  return { auth: getClient() };
}

// Sessão ativa: em produção vem do storage persistente (persistSession: true).
// Em E2E (NEXT_PUBLIC_E2E=1), o spec injeta via window.__TT_E2E_SESSION__,
// que tem prioridade sobre o storage para manter os testes herméticos.
export function e2eHookSession(): Session | null {
  if (process.env.NEXT_PUBLIC_E2E !== "1" || typeof window === "undefined") return null;
  return (window as unknown as { __TT_E2E_SESSION__?: Session }).__TT_E2E_SESSION__ ?? null;
}

export async function resolveSession(): Promise<Session | null> {
  return e2eHookSession() ?? (await getClient().getSession()).data.session;
}
