"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePlatform } from "@/components/platform/store";
import AuthPanel from "@/components/platform/Auth";
import Onboarding from "@/components/platform/Onboarding";
import Assistant from "@/components/platform/Assistant";
import Topbar from "@/components/platform/Topbar";
import { AccountLoadError, AppBoot } from "@/components/platform/PlatformState";

function Discover() {
  const { session, me, booted } = usePlatform();
  const params = useSearchParams();
  const router = useRouter();
  const [authPanel] = useState<"login" | "signup">(() =>
    params.get("mode") === "signup" ? "signup" : "login"
  );

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
        onAuthenticated={() => window.location.reload()}
      />
    );
  }

  if (!me) {
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
      <section className="page-wrap">
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
