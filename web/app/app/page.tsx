"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PlatformProvider, usePlatform } from "@/components/platform/store";
import AuthPanel from "@/components/platform/Auth";
import Onboarding from "@/components/platform/Onboarding";
import Assistant from "@/components/platform/Assistant";
import Topbar from "@/components/platform/Topbar";
import ContentKitDialog from "@/components/platform/ContentKitDialog";

function Discover() {
  const { session, me, booted, globalError, reloadMe } = usePlatform();
  const params = useSearchParams();
  const router = useRouter();
  const [authPanel, setAuthPanel] = useState<"login" | "signup">("login");
  const [kitDialog, setKitDialog] = useState<{
    productId: string;
    mode: "save" | "kit";
    forceNew: boolean;
  } | null>(null);

  useEffect(() => {
    if (params.get("mode") === "signup") setAuthPanel("signup");
  }, [params]);

  const recovery =
    typeof window !== "undefined" && window.location.hash.includes("type=recovery");

  if (!booted) {
    return (
      <main className="auth-view">
        <p className="muted">Carregando...</p>
      </main>
    );
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
              onNeedKit={(productId, mode, forceNew) => setKitDialog({ productId, mode, forceNew })}
            />
          </section>
        )}
      </section>
      {kitDialog && (
        <ContentKitDialog
          productId={kitDialog.productId}
          mode={kitDialog.mode}
          forceNew={kitDialog.forceNew}
          onClose={() => setKitDialog(null)}
          onCreated={(kit) => {
            setKitDialog(null);
            router.push(`/app/produtos/${kitDialog.productId}/kits/${kit.id}`);
          }}
        />
      )}
    </main>
  );
}

import Admin from "@/components/platform/Admin";

export default function AppPage() {
  return (
    <PlatformProvider>
      <Suspense>
        <Discover />
      </Suspense>
    </PlatformProvider>
  );
}
