import PlansView from "@/components/platform/PlansView";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Planos e assinatura | TemTrend",
  description: "Veja seu acesso atual, escolha o ciclo mensal ou anual e assine o Pro sem sair do painel.",
  path: "/conta/planos",
  absoluteTitle: true,
  noindex: true,
});

export default async function ContaPlanosPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string | string[] }>;
}) {
  const { period } = await searchParams;
  return <PlansView initialPeriod={period === "monthly" ? "monthly" : "annual"} />;
}
