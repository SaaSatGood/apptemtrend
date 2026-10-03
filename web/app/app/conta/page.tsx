"use client";

import { useState } from "react";
import { PlatformProvider, usePlatform } from "@/components/platform/store";
import RequireAuth from "@/components/platform/RequireAuth";
import Topbar from "@/components/platform/Topbar";
import Account from "@/components/platform/Account";
import Onboarding from "@/components/platform/Onboarding";

function Content() {
  const { admin } = usePlatform();
  const [editing, setEditing] = useState(false);

  if (admin) {
    return (
      <main id="app-view">
        <Topbar />
        <section className="page-wrap">
          <div className="empty-state">
            <h3>Área de creators.</h3>
            <p>Sua conta é administradora.</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main id="app-view">
      <Topbar />
      <section className="page-wrap">
        {editing ? (
          <Onboarding editing onDone={() => setEditing(false)} />
        ) : (
          <Account onEditPreferences={() => setEditing(true)} />
        )}
      </section>
    </main>
  );
}

export default function ContaPage() {
  return (
    <PlatformProvider>
      <RequireAuth allowOnboarding>
        <Content />
      </RequireAuth>
    </PlatformProvider>
  );
}
