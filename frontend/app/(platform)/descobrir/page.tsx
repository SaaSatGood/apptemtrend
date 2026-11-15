"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Assistant from "@/components/platform/Assistant";

function Discovery() {
  const params = useSearchParams();
  return (
    <section id="creator-content-view" className="tt-discovery">
      {/* key: cada "nova conversa" remonta o chat do zero. */}
      <Assistant key={params.get("nova") ?? "default"} />
    </section>
  );
}

export default function DiscoveryPage() {
  return (
    <Suspense fallback={null}>
      <Discovery />
    </Suspense>
  );
}
