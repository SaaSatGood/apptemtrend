"use client";

import Link from "next/link";
import { PlatformProvider, usePlatform } from "@/components/platform/store";
import RequireAuth from "@/components/platform/RequireAuth";
import Topbar from "@/components/platform/Topbar";
import Admin from "@/components/platform/Admin";

function Content() {
  const { admin } = usePlatform();
  if (!admin) {
    return (
      <main id="app-view">
        <Topbar />
        <section className="page-wrap">
          <div className="empty-state">
            <h3>Acesso negado.</h3>
            <p>Sua conta não tem permissão de administração.</p>
            <Link className="primary" href="/app">Voltar para Descobrir</Link>
          </div>
        </section>
      </main>
    );
  }
  return (
    <main id="app-view">
      <Topbar />
      <section className="page-wrap">
        <Admin />
      </section>
    </main>
  );
}

export default function AdminPage() {
  return (
    <PlatformProvider>
      <RequireAuth>
        <Content />
      </RequireAuth>
    </PlatformProvider>
  );
}
