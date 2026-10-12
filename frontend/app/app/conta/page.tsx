"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePlatform } from "@/components/platform/store";
import RequireAuth from "@/components/platform/RequireAuth";
import Topbar from "@/components/platform/Topbar";
import Account from "@/components/platform/Account";
import Onboarding from "@/components/platform/Onboarding";

function Content() {
  const { admin } = usePlatform();
  const router = useRouter();
  const params = useSearchParams();
  const [editing, setEditing] = useState(false);
  const showEditor = (editing || params.get("preferencias") === "1") && !admin;

  function closeEditor() {
    setEditing(false);
    router.replace("/app/conta");
  }

  return (
    <main id="app-view" className={showEditor ? "app-view--editing-onboarding" : undefined}>
      <Topbar />
      <section id="page-content" className="page-wrap">
        {showEditor ? (
          <Onboarding editing onDone={closeEditor} />
        ) : (
          <Account onEditPreferences={() => {
            if (!admin) setEditing(true);
          }} />
        )}
      </section>
    </main>
  );
}

export default function ContaPage() {
  return (
    <RequireAuth allowOnboarding>
      <Suspense fallback={null}>
        <Content />
      </Suspense>
    </RequireAuth>
  );
}
