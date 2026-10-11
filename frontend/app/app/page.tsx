"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import { usePlatform } from "@/components/platform/store";
import AuthPanel from "@/components/platform/Auth";
import Onboarding from "@/components/platform/Onboarding";
import Assistant from "@/components/platform/Assistant";
import Topbar from "@/components/platform/Topbar";
import { AccountLoadError, AppBoot } from "@/components/platform/PlatformState";

function Discover() {
  const { session, me, meLoading, globalError, booted } = usePlatform();
  const router = useRouter();

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
    // Sessão válida mas perfil ainda carregando (login recente, retry em
    // voo): mostra boot em vez do erro "conta não encontrada".
    if (meLoading || !globalError) {
      return <AppBoot />;
    }
    return <AccountLoadError />;
  }

  const meta = (session.user.user_metadata ?? {}) as { full_name?: string; name?: string };
  const firstName =
    meta.full_name?.split(" ")[0] ||
    meta.name?.split(" ")[0] ||
    session.user.email?.split("@")[0] ||
    "";
  const showNav = me.onboarding_completo || me.is_admin;

  return (
    <main id="app-view">
      {showNav && <Topbar />}
      <section className={`page-wrap${showNav ? "" : " page-wrap--onboarding"}`}>
        {!me.onboarding_completo && !me.is_admin ? (
          <Onboarding editing={false} onDone={() => window.location.reload()} />
        ) : me.is_admin ? (
          <Admin />
        ) : (
          <section id="creator-content-view">
            {firstName && <p className="greeting">Olá, {firstName}.</p>}
            <Assistant
              onOpen={(id) => router.push(`/app/produtos/${id}`)}
            />
          </section>
        )}
      </section>
    </main>
  );
}

import Admin from "@/components/platform/Admin";

export default function AppPage() {
  return (
    <Suspense fallback={<AppBoot />}>
      <Discover />
    </Suspense>
  );
}
