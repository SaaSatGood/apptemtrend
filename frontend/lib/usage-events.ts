/**
 * Aviso leve para a sidebar recarregar o consumo do plano assim que uma busca
 * ou um roteiro é gerado. Sem isso, o contador de 0–100% só atualizaria ao
 * trocar de rota.
 */
export const PLAN_USAGE_CHANGED_EVENT = "temtrend:plan-usage-changed";

export function notifyPlanUsageChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PLAN_USAGE_CHANGED_EVENT));
}
