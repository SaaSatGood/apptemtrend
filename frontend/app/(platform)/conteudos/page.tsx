"use client";

import { usePlatform } from "@/components/platform/store";
import ContentsView from "@/components/platform/ContentsView";

export default function ConteudosPage() {
  const { admin } = usePlatform();

  if (admin) {
    return (
      <div className="empty-state">
        <h3>Área de creators.</h3>
        <p>Sua conta é administradora.</p>
      </div>
    );
  }

  return (
    <section id="creator-contents-view">
      <ContentsView />
    </section>
  );
}
