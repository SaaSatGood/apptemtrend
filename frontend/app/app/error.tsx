"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function PlatformError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="auth-view account-load-error">
      <div className="empty-state" role="alert">
        <span className="state-icon" aria-hidden="true">!</span>
        <p className="eyebrow">Algo saiu do esperado</p>
        <h1>Esta página não abriu corretamente.</h1>
        <p>Seu trabalho continua salvo. Tente carregar esta área mais uma vez.</p>
        <div className="state-actions">
          <button className="primary" type="button" onClick={reset}>Tentar novamente</button>
          <Link className="ghost" href="/app">Ir para Descobrir</Link>
        </div>
      </div>
    </main>
  );
}
