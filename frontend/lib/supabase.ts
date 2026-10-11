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
