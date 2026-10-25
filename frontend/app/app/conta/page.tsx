"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePlatform } from "@/components/platform/store";
import Account from "@/components/platform/Account";
import Onboarding from "@/components/platform/Onboarding";

function Content() {
  const { admin } = usePlatform();
  const router = useRouter();
  const params = useSearchParams();
  const [editing, setEditing] = useState(false);
  const showEditor = (editing || params.get("preferencias") === "1") && !admin;

  function closeEditor() {
    setEditing(false);
    router.replace("/app/conta");
  }

  if (showEditor) {
    return (
      <div className="account-editing">
        <Onboarding editing onDone={closeEditor} />
      </div>
    );
  }

  return (
    <Account
      onEditPreferences={() => {
        if (!admin) setEditing(true);
      }}
    />
  );
}

export default function ContaPage() {
  return (
    <Suspense fallback={null}>
      <Content />
    </Suspense>
  );
}
