/**
 * Aviso leve para a sidebar recarregar o histórico do Descobrir. A conversa
 * ganha URL própria via history.replaceState, que não dispara o roteador do
 * Next — sem este evento, a nova sessão só apareceria após navegar.
 */
export const SESSIONS_CHANGED_EVENT = "temtrend:sessions-changed";

export function notifySessionsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SESSIONS_CHANGED_EVENT));
}
