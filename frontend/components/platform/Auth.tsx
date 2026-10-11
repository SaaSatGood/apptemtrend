"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { humanAuthError } from "@/lib/api";

type OAuthProvider = "google" | "facebook" | "apple";

const PROVIDERS: Array<{ id: OAuthProvider; label: string; icon: string }> = [
  { id: "google", label: "Continuar com Google", icon: "G" },
  { id: "facebook", label: "Continuar com Facebook", icon: "f" },
  { id: "apple", label: "Continuar com Apple", icon: "" },
];

const AUTH_BENEFITS = [
  ["01", "Descubra produtos reais", "Preço, vendas, comissão e link do TikTok Shop."],
  ["02", "Receba um plano de gravação", "Abertura, cenas, roteiro e chamada final em um só lugar."],
  ["03", "Organize sua produção", "Salve ideias e acompanhe o que já está pronto para gravar."],
];

export default function AuthPanel({
  initialPanel,
  recoveryHint,
  onAuthenticated,
}: {
  initialPanel?: string;
  recoveryHint?: string | null;
  onAuthenticated: () => void;
}) {
  void initialPanel;
  void recoveryHint;
  void onAuthenticated;
  const [error, setError] = useState("");
  const [busyProvider, setBusyProvider] = useState<OAuthProvider | null>(null);

  async function continueWith(provider: OAuthProvider) {
    setBusyProvider(provider);
    setError("");
    const { error } = await supabase().auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
    if (error) {
      setError(humanAuthError(error));
      setBusyProvider(null);
    }
  }

  return (
    <main id="login-view" className="auth-view">
      <Link className="auth-logo" href="/" aria-label="Voltar para a página inicial">
        <span aria-hidden="true">T</span><b>TemTrend</b>
      </Link>
      <div className="auth-layout">
        <aside className="auth-value" aria-label="O que você encontra na TemTrend">
          <p className="eyebrow">Da descoberta à gravação</p>
          <h2>Menos dúvida.<br />Mais conteúdo pronto.</h2>
          <div className="auth-benefits">
            {AUTH_BENEFITS.map(([number, benefitTitle, description]) => (
              <div key={number}>
                <span>{number}</span>
                <p><strong>{benefitTitle}</strong>{description}</p>
              </div>
            ))}
          </div>
          <small>Você escolhe o produto. A TemTrend ajuda a decidir o que gravar.</small>
        </aside>
        <section className="auth-shell" aria-live="polite">
        <div className="auth-accent" aria-hidden="true"></div>
        <div id="login-heading" className="auth-heading">
          <p className="eyebrow">Acesso rápido</p>
          <h1>Comece a vender.</h1>
          <p>Entre com sua conta Google, Facebook ou Apple.</p>
        </div>

        <div className="stack auth-form">
          {PROVIDERS.map(({ id, label, icon }) => (
            <button
              key={id}
              className="provider-button google-button"
              type="button"
              onClick={() => continueWith(id)}
              disabled={busyProvider !== null}
            >
              <span className="provider-icon google-icon" aria-hidden="true">{icon}</span>
              {busyProvider === id ? "Conectando..." : label}
            </button>
          ))}
          <p className="legal-note">
            Ao continuar, você concorda com nossos <Link href="/termos" target="_blank" rel="noopener">Termos</Link> e{" "}
            <Link href="/privacidade" target="_blank" rel="noopener">Política de Privacidade</Link>.
          </p>
        </div>

        {error && <p className="form-message error" role="alert">{error}</p>}
        </section>
      </div>
      <Link className="back-home" href="/">← Voltar para o início</Link>
    </main>
  );
}
