"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePlatform } from "@/components/platform/store";
import AuthPanel from "@/components/platform/Auth";
import Onboarding from "@/components/platform/Onboarding";
import Assistant from "@/components/platform/Assistant";
import Topbar from "@/components/platform/Topbar";
import { AccountLoadError, AppBoot } from "@/components/platform/PlatformState";

const Admin = dynamic(() => import("@/components/platform/Admin"), {
  ssr: false,
  loading: () => <AppBoot />,
});

function Discover() {
  const { session, me, meLoading, globalError, booted } = usePlatform();
  const params = useSearchParams();
  const router = useRouter();
  const [authPanel] = useState<"login" | "signup">(() =>
    params.get("mode") === "signup" ? "signup" : "login"
  );
  const requestedNext = params.get("next");
  const safeNext = requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
    ? requestedNext
    : null;

  useEffect(() => {
    if (session && me?.onboarding_completo && safeNext) router.replace(safeNext);
  }, [me?.onboarding_completo, router, safeNext, session]);

  const recovery =
    typeof window !== "undefined" && window.location.hash.includes("type=recovery");

  if (!booted) {
    return <AppBoot />;
  }

  if (!session || recovery) {
    return (
      <AuthPanel
        initialPanel={recovery ? "reset" : authPanel}
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

  const showNav = me.onboarding_completo || me.is_admin;

  return (
    <main id="app-view">
      {showNav && <Topbar />}
      <section id="page-content" className={`page-wrap${showNav ? "" : " page-wrap--onboarding"}`}>
        {!me.onboarding_completo && !me.is_admin ? (
          <Onboarding editing={false} onDone={() => {
            // reloadMe() já atualizou o perfil; refresh sem reload de página
            // (sessão em memória não sobrevive a reload).
            router.push(safeNext ?? "/app/producao");
          }} />
        ) : me.is_admin ? (
          <Admin />
        ) : (
          <section id="creator-content-view">
            <Assistant
              onOpen={(id) => router.push(`/app/produtos/${id}`)}
            />
          </section>
        )}
      </section>
    </main>
  );
}

export default function AppPage() {
  return (
    <Suspense fallback={<AppBoot />}>
      <Discover />
    </Suspense>
  );
}
