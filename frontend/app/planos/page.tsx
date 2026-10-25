import type { Metadata } from "next";
import PricingPage from "@/components/pricing/PricingPage";

export const metadata: Metadata = {
  title: "Planos | TemTrend",
  description:
    "Comece grátis com 3 pesquisas e 3 roteiros por conta, sem prazo de teste. Para criar sem limites, conheça o Pro mensal ou anual. Cancele quando quiser.",
};

export default async function PlanosPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string | string[] }>;
}) {
  const { period } = await searchParams;
  return <PricingPage initialPeriod={period === "monthly" ? "monthly" : "annual"} />;
}
