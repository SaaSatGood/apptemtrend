import { api } from "@/lib/api";
import { resolveSession } from "@/lib/supabase";
import type { DiscoverySession } from "@/lib/types";

/**
 * Conversas do Descobrir já carregadas nesta aba. Reabrir um chat pelo
 * histórico pinta a conversa na hora e, em paralelo, busca a versão atual
 * no servidor. A chave inclui o usuário para não vazar turnos entre contas
 * no mesmo navegador.
 */
const sessions = new Map<string, DiscoverySession>();
const inFlight = new Map<string, Promise<DiscoverySession>>();

function cacheKey(userId: string | undefined, sessionId: string) {
  return `${userId ?? "anon"}:${sessionId}`;
}

export function peekDiscoverySession(userId: string | undefined, sessionId: string): DiscoverySession | null {
  return sessions.get(cacheKey(userId, sessionId)) ?? null;
}

export function rememberDiscoverySession(userId: string | undefined, session: DiscoverySession): void {
  sessions.set(cacheKey(userId, session.id), session);
}

export function forgetDiscoverySession(userId: string | undefined, sessionId: string): void {
  sessions.delete(cacheKey(userId, sessionId));
}

/** Busca a sessão e reaproveita a mesma requisição se o chat já estiver abrindo. */
export function fetchDiscoverySession(
  userId: string | undefined,
  sessionId: string,
  token?: string,
): Promise<DiscoverySession> {
  const key = cacheKey(userId, sessionId);
  const pending = inFlight.get(key);
  if (pending) return pending;
  const request = api<{ session: DiscoverySession }>(`/assistant/sessions/${sessionId}`, token)
    .then(({ session }) => {
      if (!session?.id) throw new Error("Conversa não encontrada.");
      sessions.set(key, session);
      return session;
    })
    .finally(() => { inFlight.delete(key); });
  inFlight.set(key, request);
  return request;
}

/** Pré-carrega ao passar o mouse/focar o item do histórico. */
export function prefetchDiscoverySession(userId: string | undefined, sessionId: string): void {
  const key = cacheKey(userId, sessionId);
  if (sessions.has(key) || inFlight.has(key)) return;
  void (async () => {
    try {
      const active = await resolveSession();
      if (!active?.access_token) return;
      await fetchDiscoverySession(userId, sessionId, active.access_token);
    } catch {
      // Histórico é um extra: falhar no prefetch não afeta o clique.
    }
  })();
}
