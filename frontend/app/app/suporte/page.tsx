"use client";

import { usePlatform } from "@/components/platform/store";
import Support from "@/components/platform/Support";

export default function SuportePage() {
  const { admin } = usePlatform();

  if (admin) {
    return (
      <div className="empty-state">
        <h3>Área de creators.</h3>
        <p>Responda os chamados pelo painel administrativo, na aba Suporte.</p>
      </div>
    );
  }

  return (
    <section id="creator-support-view">
      <Support />
    </section>
  );
}
