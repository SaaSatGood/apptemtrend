"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Account from "@/components/platform/Account";

function Content() {
  const router = useRouter();
  const params = useSearchParams();
  // Link antigo de preferências dentro da conta.
  const legacyPreferences = params.get("preferencias") === "1";

  useEffect(() => {
    if (legacyPreferences) router.replace("/preferencias");
  }, [legacyPreferences, router]);

  if (legacyPreferences) return null;

  return <Account />;
}

export default function ContaPage() {
  return (
    <Suspense fallback={null}>
      <Content />
    </Suspense>
  );
}
