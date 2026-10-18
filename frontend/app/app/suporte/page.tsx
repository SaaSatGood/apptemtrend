"use client";

import { usePlatform } from "@/components/platform/store";
import RequireAuth from "@/components/platform/RequireAuth";
import Topbar from "@/components/platform/Topbar";
import Support from "@/components/platform/Support";

function Content() {
  const { admin } = usePlatform();
  if (admin) {
    return (
      <main id="app-view">
        <Topbar />
        <section id="page-content" className="page-wrap">
          <div className="empty-state">
            <h3>Área de creators.</h3>
            <p>Responda os chamados pelo painel administrativo, na aba Suporte.</p>
          </div>
        </section>
      </main>
    );
  }
  return (
    <main id="app-view">
      <Topbar />
      <section id="page-content" className="page-wrap">
        <section id="creator-support-view">
          <Support />
        </section>
      </section>
    </main>
  );
}

export default function SuportePage() {
  return (
    <RequireAuth>
      <Content />
    </RequireAuth>
  );
}
