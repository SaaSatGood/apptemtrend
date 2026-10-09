"use client";

import { useEffect, useRef } from "react";

/** Native modal provides focus containment, Escape and focus restoration. */
export default function Modal({ children, titleId, onClose, busy = false }: { children: React.ReactNode; titleId: string; onClose: () => void; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const trigger = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      queueMicrotask(() => { if (trigger?.isConnected) trigger.focus(); });
    };
  }, []);
  return <dialog ref={ref} className="publication-dialog" aria-labelledby={titleId} aria-modal="true" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>{children}</dialog>;
}
