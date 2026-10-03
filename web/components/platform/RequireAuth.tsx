"use client";

import AuthPanel from "./Auth";
import Onboarding from "./Onboarding";
import { usePlatform } from "./store";

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
  const { session, me, booted, globalError, reloadMe } = usePlatform();

  if (!booted) {
    return (
      <main className="auth-view">
        <p className="muted">Carregando...</p>
      </main>
    );
  }

  if (!session) {
    return (
      <AuthPanel
        initialPanel="login"
        recoveryHint={null}
        onAuthenticated={() => window.location.reload()}
      />
    );
  }

  if (typeof window !== "undefined" && window.location.hash.includes("type=recovery")) {
    return (
      <AuthPanel
        initialPanel="reset"
        recoveryHint="Se o link expirou, volte e solicite um novo link de recuperação."
        onAuthenticated={() => window.location.reload()}
      />
    );
  }

  if (!me) {
    return (
      <main className="auth-view">
        <div className="empty-state" role="alert">
          <h3>Não conseguimos carregar sua conta.</h3>
          <p>{globalError || "Tente novamente."}</p>
          <button className="primary" type="button" onClick={() => void reloadMe()}>
            Tentar novamente
          </button>
        </div>
      </main>
    );
  }

  if (!me.is_admin && !me.onboarding_completo && !allowOnboarding) {
    return (
      <main id="app-view">
        <section className="page-wrap">
          <Onboarding editing={false} onDone={() => window.location.reload()} />
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
