"use client";

import { usePlatform } from "@/components/platform/store";
import Production from "@/components/platform/Production";

export default function ProducaoPage() {
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
    <section id="creator-content-view">
      <Production />
    </section>
  );
}
