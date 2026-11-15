"use client";

import { usePlatform } from "@/components/platform/store";
import ResultsView from "@/components/platform/ResultsView";

export default function ResultadosPage() {
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
    <section id="creator-results-view">
      <ResultsView />
    </section>
  );
}
