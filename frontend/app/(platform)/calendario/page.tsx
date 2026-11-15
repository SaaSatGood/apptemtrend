"use client";

import { usePlatform } from "@/components/platform/store";
import CalendarView from "@/components/platform/CalendarView";

export default function CalendarioPage() {
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
    <section id="creator-calendar-view">
      <CalendarView />
    </section>
  );
}
