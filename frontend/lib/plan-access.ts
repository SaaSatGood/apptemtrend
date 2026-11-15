export type PlanState = {
  plan?: string | null;
  plan_status?: string | null;
  current_period_end?: string | null;
} | null | undefined;

/** Espelha o effectivePlan do backend para decidir o que a UI pode exibir. */
export function hasPaidPlan(creator: PlanState): boolean {
  if (!creator?.plan || creator.plan === "free") return false;
  if (!["active", "past_due", "canceled"].includes(creator.plan_status ?? "")) return false;
  const end = creator.current_period_end ? Date.parse(creator.current_period_end) : Number.NaN;
  return Number.isFinite(end) && end > Date.now();
}
