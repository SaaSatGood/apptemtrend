"use client";

import { PlatformProvider, usePlatform } from "@/components/platform/store";
import RequireAuth from "@/components/platform/RequireAuth";
import Topbar from "@/components/platform/Topbar";
import Production from "@/components/platform/Production";

function Content() {
  const { admin } = usePlatform();
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
        <section id="creator-content-view">
          <Production />
        </section>
      </section>
    </main>
  );
}

export default function ProducaoPage() {
  return (
    <PlatformProvider>
      <RequireAuth>
        <Content />
      </RequireAuth>
    </PlatformProvider>
  );
}
