"use client";

import { GoTrueClient, type Session } from "@supabase/auth-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

export type { Session };

let client: GoTrueClient | null = null;

// O GoTrue consome e LIMPA o hash do link de recuperação assim que inicializa.
// Guardamos a intenção no carregamento do módulo (antes do initialize) para a
// tela "Nova senha" não desaparecer quando o app terminar de montar.
const RECOVERY_FLAG = "temtrend:password-recovery";

if (typeof window !== "undefined" && /(?:^|[#&])type=recovery(?:&|$)/.test(window.location.hash)) {
  try {
    window.sessionStorage.setItem(RECOVERY_FLAG, "1");
  } catch {
    /* storage bloqueado: a tela de reset ainda abre pela sessão do link */
  }
}

export function hasRecoveryIntent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(RECOVERY_FLAG) === "1";
  } catch {
    return false;
  }
}

export function clearRecoveryIntent(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(RECOVERY_FLAG);
  } catch {
    /* noop */
  }
}

function storageKeyFor(url: string): string {
  // Formato idêntico ao do supabase-js (sb-<ref>-auth-token). Mantém a sessão
  // no localStorage para o login sobreviver a recarregamentos e navegações.
  try {
    return `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
  } catch {
    return "sb-auth-token";
  }
}

const STORAGE_KEY = storageKeyFor(SUPABASE_URL);

function getClient(): GoTrueClient {
  if (!client) {
    if (!SUPABASE_URL) {
      throw new Error("Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL no .env.local.");
    }
    client = new GoTrueClient({
      url: `${SUPABASE_URL.replace(/\/$/, "")}/auth/v1`,
      headers: { apikey: SUPABASE_ANON_KEY },
      storageKey: STORAGE_KEY,
      autoRefreshToken: true,
      // Sessão persistida no navegador: sair da página, recarregar ou voltar
      // depois mantém a conta conectada. O logout só acontece por ação
      // explícita (Sair da conta) ou expiração/revogação do token.
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

// Sessão ativa: persistida no navegador (persistSession: true) e renovada
// automaticamente. Em E2E (NEXT_PUBLIC_E2E=1), o spec injeta via
// window.__TT_E2E_SESSION__, que tem prioridade para manter os testes
// herméticos.
export function e2eHookSession(): Session | null {
  if (process.env.NEXT_PUBLIC_E2E !== "1" || typeof window === "undefined") return null;
  return (window as unknown as { __TT_E2E_SESSION__?: Session }).__TT_E2E_SESSION__ ?? null;
}

export async function resolveSession(): Promise<Session | null> {
  return e2eHookSession() ?? (await getClient().getSession()).data.session;
}
