"use client";

import { useEffect } from "react";
import { markFirstSeen, track } from "@/lib/track";

// Dispara 1 evento de visualização (landing, /planos) e marca o primeiro
// contato para medir o TTV até o primeiro kit.
export default function TrackView({ event }: { event: string }) {
  useEffect(() => {
    markFirstSeen();
    track(event);
  }, [event]);
  return null;
}
