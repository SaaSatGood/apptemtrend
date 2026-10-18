import type { Metadata } from "next";
import PricingPage from "@/components/pricing/PricingPage";

export const metadata: Metadata = {
  title: "Planos | TemTrend",
  description:
    "Comece com 7 dias de Pro por nossa conta e cresça quando fizer sentido: planos mensais ou anuais com PIX ou cartão, variações de roteiro e produção ilimitada. Cancele quando quiser.",
};

export default function PlanosPage() {
  return <PricingPage />;
}
