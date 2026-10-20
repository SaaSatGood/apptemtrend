export function displayPlanName(name?: string | null): string {
  return (name || "Sem plano").replace(/\s*\(pré-lançamento\)/i, "");
}
