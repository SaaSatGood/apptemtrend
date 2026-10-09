"use client";

import { useState } from "react";
import { usePlatform } from "@/components/platform/store";
import RequireAuth from "@/components/platform/RequireAuth";
import Topbar from "@/components/platform/Topbar";
import Account from "@/components/platform/Account";
import Onboarding from "@/components/platform/Onboarding";

function Content() {
  const { admin } = usePlatform();
  const [editing, setEditing] = useState(false);

  return (
    <main id="app-view">
      <Topbar />
      <section className="page-wrap">
        {editing && !admin ? (
          <Onboarding editing onDone={() => setEditing(false)} />
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
      <Content />
    </RequireAuth>
  );
}
