"use client";

import { useState } from "react";
import Link from "next/link";
import { friendlyError } from "@/lib/api";
import { usePlatform } from "./store";

export function AppBoot() {
  return (
    <main className="app-boot" aria-busy="true" aria-label="Carregando TemTrend">
      <div className="app-boot-brand"><span aria-hidden="true">T</span><b>TemTrend</b></div>
      <div className="app-boot-bar"><i /></div>
      <p>Preparando sua experiência...</p>
    </main>
  );
}

export function AccountLoadError() {
  const { globalError, reloadMe, signOut } = usePlatform();
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  async function retry() {
    setRetrying(true);
    setRetryError(null);
    try {
      await reloadMe();
    } catch (error) {
      setRetryError(friendlyError(error, "A conexão ainda não respondeu. Tente novamente em instantes."));
    } finally {
      setRetrying(false);
    }
  }

  return (
    <main className="auth-view account-load-error">
      <div className="empty-state" role="alert">
        <span className="state-icon" aria-hidden="true">!</span>
        <p className="eyebrow">Falha de conexão</p>
        <h1>Não conseguimos carregar sua conta.</h1>
        <p>{retryError || globalError || "A TemTrend pode estar temporariamente indisponível."}</p>
        <div className="state-actions">
          <button className="primary" type="button" disabled={retrying} onClick={() => void retry()}>
            {retrying ? "Tentando conectar..." : "Tentar novamente"}
          </button>
          <button className="ghost" type="button" onClick={() => void signOut()}>
            Sair e trocar de conta
          </button>
        </div>
        <Link className="text-link" href="/">Voltar para o site</Link>
      </div>
    </main>
  );
}
