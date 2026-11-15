import PricingPage from "@/components/pricing/PricingPage";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Planos e preços",
  description:
    "Compare o plano Grátis e o Pro da TemTrend: 100 buscas e 10 roteiros por semana no Grátis; criação sem contagem e catálogo completo no Pro. Cancele quando quiser.",
  path: "/planos",
});

export default async function PlanosPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string | string[] }>;
}) {
  const { period } = await searchParams;
  return <PricingPage initialPeriod={period === "monthly" ? "monthly" : "annual"} />;
}
