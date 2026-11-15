"use client";

import dynamic from "next/dynamic";
import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { usePlatform } from "./store";
import AuthPanel from "./Auth";
import Onboarding from "./Onboarding";
import Topbar from "./Topbar";
import { AccountLoadError } from "./PlatformState";

// Painel administrativo: fora do bundle inicial do creator.
const Admin = dynamic(() => import("./Admin"), {
  ssr: false,
  loading: () => null,
});

function nextPathFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  const requested = new URLSearchParams(window.location.search).get("next");
  return requested?.startsWith("/") && !requested.startsWith("//") ? requested : null;
}

function initialAuthPanel(): "login" | "signup" {
  if (typeof window === "undefined") return "login";
  return new URLSearchParams(window.location.search).get("mode") === "signup"
    ? "signup"
    : "login";
}

/**
 * Casca persistente das rotas autenticadas.
 * Vive no layout de /app, então topo, sidebar e sessão não remontam entre
 * páginas: só o conteúdo interno da rota muda.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  const {
    session,
    me,
    meLoading,
    globalError,
    booted,
    recoveryMode,
    clearRecovery,
  } = usePlatform();
  const pathname = usePathname() || "/descobrir";
  const router = useRouter();

  useEffect(() => {
    if (!session || !me?.onboarding_completo) return;
    const next = nextPathFromLocation();
    if (next) router.replace(next);
  }, [me?.onboarding_completo, pathname, router, session]);

  // Sem tela de loading em nenhum caminho: o boot renderiza vazio e o
  // conteúdo entra direto quando a sessão/perfil estão prontos.
  let content: ReactNode = null;

  if (booted) {
    if (!session || recoveryMode) {
      content = (
        <AuthPanel
          initialPanel={recoveryMode ? "reset" : initialAuthPanel()}
          recoveryHint={
            recoveryMode && !session
              ? "Se o link expirou, volte e solicite um novo link de recuperação."
              : null
          }
          onRecoveryDone={clearRecovery}
          onExitRecovery={clearRecovery}
          onAuthenticated={() => {
            // Sessão persistida: sem reload de página. O listener do store
            // carrega /me e a UI transita sozinha.
            router.refresh();
          }}
        />
      );
    } else if (!me) {
      content = meLoading || !globalError ? (
        <div className="app-boot" role="status" aria-live="polite">
          <div className="app-boot-brand"><span aria-hidden="true">T</span><b>TemTrend</b></div>
          <p>Preparando sua conta…</p>
          <div className="app-boot-bar" aria-hidden="true"><i /></div>
        </div>
      ) : <AccountLoadError />;
    } else {
      // A conta continua acessível com onboarding incompleto: é a saída para
      // revisar dados pessoais e sessão. Preferências da IA ficam em
      // /preferencias, depois do onboarding.
      const allowOnboarding = pathname === "/conta";
      const showNav = me.onboarding_completo || me.is_admin || allowOnboarding;
      const adminHome =
        me.is_admin &&
        (pathname === "/descobrir" || pathname === "/admin");

      content = (
        <main id="app-view">
          {showNav && <Topbar />}
          <section id="page-content" className={`page-wrap${showNav ? "" : " page-wrap--onboarding"}`}>
            {!me.onboarding_completo && !me.is_admin && !allowOnboarding ? (
              <Onboarding
                onDone={(target) => {
                  // reloadMe() já atualizou o perfil; navegação sem reload.
                  // `target` leva direto ao roteiro do primeiro vídeo quando o
                  // usuário escolhe um produto na etapa final.
                  router.push(target ?? nextPathFromLocation() ?? "/descobrir");
                }}
              />
            ) : adminHome ? (
              <Admin />
            ) : (
              children
            )}
          </section>
        </main>
      );
    }
  }

  return content;
}
