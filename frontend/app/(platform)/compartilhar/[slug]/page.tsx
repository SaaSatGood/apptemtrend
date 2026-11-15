"use client";

import { useParams } from "next/navigation";
import SharedConversation from "@/components/platform/SharedConversation";

export default function CompartilharPage() {
  const params = useParams<{ slug: string }>();

  return <SharedConversation key={params.slug} slug={params.slug} />;
}
