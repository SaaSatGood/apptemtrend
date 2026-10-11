"use client";

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

  if (!booted) {
    return <AppBoot />;
  }

  if (!session) {
    return (
      <AuthPanel
        onAuthenticated={() => window.location.reload()}
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
          <Onboarding editing={false} onDone={() => window.location.reload()} />
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
