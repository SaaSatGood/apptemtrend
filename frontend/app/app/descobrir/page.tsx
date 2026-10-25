"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import Assistant from "@/components/platform/Assistant";
import PageLoading from "@/components/platform/PageLoading";

function Discovery() {
  const router = useRouter();
  return (
    <section id="creator-content-view" className="tt-discovery">
      <Assistant onOpen={(id) => router.push(`/app/produtos/${id}`)} />
    </section>
  );
}

export default function DiscoveryPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Discovery />
    </Suspense>
  );
}
