"use client";

import dynamic from "next/dynamic";
import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { usePlatform } from "./store";
import AuthPanel from "./Auth";
import Onboarding from "./Onboarding";
import Topbar from "./Topbar";
import PageLoading from "./PageLoading";
import { AccountLoadError, AppBoot } from "./PlatformState";

// Painel administrativo: fora do bundle inicial do creator.
const Admin = dynamic(() => import("./Admin"), {
  ssr: false,
  loading: () => <PageLoading />,
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
  const { session, me, meLoading, globalError, booted } = usePlatform();
  const pathname = usePathname() || "/app";
  const router = useRouter();

  useEffect(() => {
    if (!session || !me?.onboarding_completo) return;
    const next = nextPathFromLocation();
    if (next) router.replace(next);
  }, [me?.onboarding_completo, pathname, router, session]);

  const recovery =
    typeof window !== "undefined" && window.location.hash.includes("type=recovery");

  if (!booted) {
    return <AppBoot />;
  }

  if (!session || recovery) {
    return (
      <AuthPanel
        initialPanel={recovery ? "reset" : initialAuthPanel()}
        recoveryHint={
          recovery && !session
            ? "Se o link expirou, volte e solicite um novo link de recuperação."
            : null
        }
        onAuthenticated={() => {
          // Sessão em memória: sem reload de página (derrubaria a sessão).
          // O listener do store carrega /me e a UI transita sozinha.
          router.refresh();
        }}
      />
    );
  }

  if (!me) {
    // Sessão válida mas perfil ainda carregando (login recente, retry em
    // voo): mostra boot em vez do erro "conta não encontrada".
    if (meLoading || !globalError) {
      return <AppBoot />;
    }
    return <AccountLoadError />;
  }

  // A conta é o único lugar que aceita onboarding incompleto, como antes:
  // é por lá que a pessoa revisa preferências.
  const allowOnboarding = pathname === "/app/conta";
  const showNav = me.onboarding_completo || me.is_admin || allowOnboarding;
  const adminHome =
    me.is_admin &&
    (pathname === "/app" || pathname === "/app/descobrir" || pathname === "/app/admin");

  return (
    <main id="app-view">
      {showNav && <Topbar />}
      <section id="page-content" className={`page-wrap${showNav ? "" : " page-wrap--onboarding"}`}>
        {!me.onboarding_completo && !me.is_admin && !allowOnboarding ? (
          <Onboarding
            editing={false}
            onDone={() => {
              // reloadMe() já atualizou o perfil; navegação sem reload.
              router.push(nextPathFromLocation() ?? "/app");
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
