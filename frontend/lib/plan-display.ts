export function displayPlanName(name?: string | null): string {
  return (name || "Grátis").replace(/\s*\(pré-lançamento\)/i, "");
}
