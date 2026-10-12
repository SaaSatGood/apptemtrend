"use client";

import RequireAuth from "@/components/platform/RequireAuth";
import Topbar from "@/components/platform/Topbar";
import KitDetail from "@/components/platform/KitDetail";
import { useParams } from "next/navigation";

function Content() {
  const params = useParams<{ productId: string; kitId: string }>();

  return (
    <main id="app-view">
      <Topbar />
      <section id="page-content" className="page-wrap">
        <KitDetail key={params.kitId} productId={params.productId} kitId={params.kitId} />
      </section>
    </main>
  );
}

export default function KitPage() {
  return (
    <RequireAuth>
      <Content />
    </RequireAuth>
  );
}
