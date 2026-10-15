"use client";

import { useRouter } from "next/navigation";
import AuthPanel from "./Auth";
import Onboarding from "./Onboarding";
import { usePlatform } from "./store";
import { AccountLoadError, AppBoot } from "./PlatformState";

/**
 * Gate de acesso das páginas internas:
 * - sem sessão → login/cadastro;
 * - onboarding incompleto → onboarding obrigatório;
 * - admin → área admin (páginas verificam `admin` para negar creator).
 */
export default function RequireAuth({
  children,
  allowOnboarding = false,
}: {
  children: React.ReactNode;
  allowOnboarding?: boolean;
}) {
  const { session, me, meLoading, globalError, booted } = usePlatform();
  const router = useRouter();
  // Sem reload de página: sessão vive em memória e o listener do store
  // carrega o perfil sozinho após autenticar.
  const stayInApp = () => router.refresh();

  if (!booted) {
    return <AppBoot />;
  }

  if (!session) {
    return (
      <AuthPanel
        initialPanel="login"
        recoveryHint={null}
        onAuthenticated={stayInApp}
      />
    );
  }

  if (typeof window !== "undefined" && window.location.hash.includes("type=recovery")) {
    return (
      <AuthPanel
        initialPanel="reset"
        recoveryHint="Se o link expirou, volte e solicite um novo link de recuperação."
        onAuthenticated={stayInApp}
      />
    );
  }

  if (!me) {
    if (meLoading || !globalError) {
      return <AppBoot />;
    }
    return <AccountLoadError />;
  }

  if (!me.is_admin && !me.onboarding_completo && !allowOnboarding) {
    return (
      <main id="app-view">
        <section className="page-wrap page-wrap--onboarding">
          <Onboarding editing={false} onDone={() => router.push("/app/producao")} />
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
