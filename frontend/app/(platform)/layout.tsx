import type { Metadata } from "next";
import AppShell from "@/components/platform/AppShell";
import { PlatformProvider } from "@/components/platform/store";

// Área logada: fora do índice de busca (o conteúdo é privado e depende de sessão).
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};
// CSS exclusivo da plataforma: carregado só nas rotas do grupo (platform),
// mantendo a ordem relativa original (depois de canonical.css, do layout raiz).
import "../../styles/auth-lime.css";
import "../../styles/app-dashboard.css";
import "../../styles/account-page.css";
import "../../styles/contents-calendar.css";
import "../../styles/discover-studio.css";
import "../../styles/products-library.css";
import "../../styles/catalog-locked.css";
import "../../styles/results-view.css";
import "../../styles/selected-products.css";
import "../../styles/platform-unified.css";
import "../../styles/plans-dashboard.css";
import "../../styles/shared-conversation.css";
import "../../styles/platform-topbar.css";
import "../../styles/button-system.css";
// Carregado por último para o onboarding vencer os estilos legados do painel.
import "../../styles/onboarding.css";

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlatformProvider>
      <AppShell>{children}</AppShell>
    </PlatformProvider>
  );
}
