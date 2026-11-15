"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import Assistant from "@/components/platform/Assistant";

function Discovery({ sessionId }: { sessionId: string }) {
  return (
    <section id="creator-content-view" className="tt-discovery">
      {/* key força recarregar a conversa ao trocar de sessão no histórico. */}
      <Assistant key={sessionId} sessionId={sessionId} />
    </section>
  );
}

export default function DiscoverySessionPage() {
  const params = useParams<{ sessionId: string }>();
  return (
    <Suspense fallback={null}>
      <Discovery sessionId={params.sessionId ?? ""} />
    </Suspense>
  );
}
