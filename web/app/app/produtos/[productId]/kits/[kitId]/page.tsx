"use client";

import { PlatformProvider } from "@/components/platform/store";
import RequireAuth from "@/components/platform/RequireAuth";
import Topbar from "@/components/platform/Topbar";
import KitDetail from "@/components/platform/KitDetail";
import { useParams } from "next/navigation";

function Content() {
  const params = useParams<{ productId: string; kitId: string }>();

  return (
    <main id="app-view">
      <Topbar />
      <section className="page-wrap">
        <KitDetail productId={params.productId} kitId={params.kitId} />
      </section>
    </main>
  );
}

export default function KitPage() {
  return (
    <PlatformProvider>
      <RequireAuth>
        <Content />
      </RequireAuth>
    </PlatformProvider>
  );
}
