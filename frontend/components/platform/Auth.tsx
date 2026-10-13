"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { humanAuthError } from "@/lib/api";

type Panel = "login" | "signup" | "recovery" | "reset";
type OAuthProvider = "google" | "facebook" | "apple";

const PROVIDERS: Array<{ id: OAuthProvider; label: string }> = [
  { id: "google", label: "Continuar com Google" },
  { id: "facebook", label: "Continuar com Facebook" },
  { id: "apple", label: "Continuar com Apple" },
];

const COPY: Record<Panel, [string, string, string]> = {
  login: ["Seu próximo passo", "Comece a vender.", "Entre para continuar."],
  signup: ["Conta grátis", "Comece a vender.", "Crie sua conta grátis."],
  recovery: [
    "Recuperar acesso",
    "Esqueceu sua senha?",
    "Digite seu email e enviaremos um link para criar uma nova senha.",
  ],
  reset: ["Nova senha", "Crie uma nova senha.", "Escolha uma senha segura para continuar."],
};

function PasswordInput({
  id,
  autoComplete,
  placeholder,
  required = true,
}: {
  id: string;
  autoComplete: string;
  placeholder?: string;
  required?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="password-field">
      <input
        id={id}
        name={id}
        type={show ? "text" : "password"}
        required={required}
        minLength={6}
        autoComplete={autoComplete}
        placeholder={placeholder}
      />
      <button
        className="password-toggle"
        type="button"
        aria-label={show ? "Ocultar senha" : "Mostrar senha"}
        onClick={() => setShow((v) => !v)}
      >
        {show ? "Ocultar" : "Mostrar"}
      </button>
    </div>
  );
}

function ProviderButtons({
  dividerLabel,
  busy,
  busyProvider,
  onSelect,
}: {
  dividerLabel: string;
  busy: boolean;
  busyProvider: OAuthProvider | null;
  onSelect: (provider: OAuthProvider) => void;
}) {
  return (
    <>
      <div className="auth-providers">
        {PROVIDERS.map(({ id, label }) => (
          <button
            key={id}
            className="provider-button google-button"
            type="button"
            aria-label={busyProvider === id ? `Conectando com ${id}` : label}
            onClick={() => onSelect(id)}
            disabled={busyProvider !== null || busy}
          >
            <span className="provider-label">{busyProvider === id ? "Conectando..." : label}</span>
            <span className="provider-label-short" aria-hidden="true">{id === "google" ? "Google" : id === "facebook" ? "Facebook" : "Apple"}</span>
          </button>
        ))}
      </div>
      <div className="divider"><span>{dividerLabel}</span></div>
    </>
  );
}

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
  initialPanel: Panel;
  recoveryHint: string | null;
  onAuthenticated: () => void;
}) {
  const [panel, setPanel] = useState<Panel>(initialPanel);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyProvider, setBusyProvider] = useState<OAuthProvider | null>(null);
  const [signupPassword, setSignupPassword] = useState("");

  const [eyebrow, title, sub] = COPY[panel];

  function switchPanel(next: Panel) {
    setError("");
    setNotice("");
    setPanel(next);
  }

  async function continueWithProvider(provider: OAuthProvider) {
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

  async function waitForPersistedSession(timeoutMs = 2500): Promise<boolean> {
    // O signIn resolve antes do storage do GoTrue terminar de gravar em
    // alguns navegadores; recarregar antes disso faz o boot não achar a
    // sessão e cair em "conta não encontrada" mesmo logado.
    const started = Date.now();
    for (;;) {
      try {
        const { data } = await supabase().auth.getSession();
        if (data.session) return true;
      } catch {
        /* tenta de novo até o timeout */
      }
      if (Date.now() - started >= timeoutMs) return false;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError("");
    setNotice("");
    setBusy(true);
    setBusyLabel("Entrando...");
    const { data, error } = await supabase().auth.signInWithPassword({
      email: String(form.get("email")).trim().toLowerCase(),
      password: String(form.get("password")),
    });
    if (error) {
      setBusy(false);
      setError(humanAuthError(error));
      return;
    }
    if (!data.session) {
      setBusy(false);
      setError("Confirme seu email antes de entrar.");
      return;
    }
    const persisted = await waitForPersistedSession();
    setBusy(false);
    if (!persisted) {
      setError("Entramos na sua conta, mas o navegador ainda não salvou a sessão. Recarregue a página para continuar.");
      return;
    }
    onAuthenticated();
  }

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const nome = String(form.get("signup-name")).trim();
    if (nome.length < 2) {
      setError("Informe seu nome com pelo menos 2 caracteres.");
      return;
    }
    setError("");
    setNotice("");
    setBusy(true);
    setBusyLabel("Criando sua conta...");
    const { data, error } = await supabase().auth.signUp({
      email: String(form.get("signup-email")).trim().toLowerCase(),
      password: String(form.get("signup-password")),
      options: {
        data: { full_name: nome, name: nome },
        emailRedirectTo: window.location.origin + window.location.pathname,
      },
    });
    if (error) {
      setBusy(false);
      setError(humanAuthError(error));
      return;
    }
    if (data.session) {
      const persisted = await waitForPersistedSession();
      setBusy(false);
      if (!persisted) {
        setError("Conta criada, mas o navegador ainda não salvou a sessão. Recarregue a página para continuar.");
        return;
      }
      onAuthenticated();
      return;
    }
    setBusy(false);
    switchPanel("login");
    setNotice("Conta criada. Confira seu email para confirmar e entrar.");
  }

  async function handleRecovery(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setNotice("");
    setBusy(true);
    setBusyLabel("Enviando...");
    const { error } = await supabase().auth.resetPasswordForEmail(
      String(form.get("recovery-email")).trim().toLowerCase(),
      { redirectTo: window.location.origin + window.location.pathname }
    );
    setBusy(false);
    if (error) {
      setError(humanAuthError(error));
      return;
    }
    setNotice("Confira seu email. Enviamos um link para criar sua nova senha.");
  }

  async function handleReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("new-password"));
    if (password.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== String(form.get("confirm-password"))) {
      setError("As senhas não conferem.");
      return;
    }
    setBusy(true);
    setBusyLabel("Salvando...");
    const { error } = await supabase().auth.updateUser({ password });
    if (error) {
      setError(humanAuthError(error));
      setBusy(false);
      return;
    }
    await supabase().auth.signOut({ scope: "local" });
    try {
      window.localStorage.removeItem("temtrend_onboarding");
    } catch {
      /* noop */
    }
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    setBusy(false);
    switchPanel("login");
    setNotice("Senha atualizada. Entre para continuar.");
  }

  return (
    <main id="login-view" className={`auth-view${panel === "signup" ? " auth-view--signup" : ""}`}>
      <Link className="auth-logo" href="/" aria-label="Voltar para a página inicial">
        <span aria-hidden="true">T</span><b>TemTrend</b>
      </Link>
      <div className="auth-layout">
        <aside className="auth-value" aria-label="O que você encontra na TemTrend">
          <div className="auth-value-intro">
            <p className="eyebrow">Da descoberta à gravação</p>
            <h2>Seu próximo vídeo começa <em>com um plano.</em></h2>
            <p>Encontre um produto, entenda o que mostrar e grave do seu jeito.</p>
          </div>
          <div className="auth-benefits">
            {AUTH_BENEFITS.map(([number, benefitTitle, description]) => (
              <div key={number}>
                <span>{number}</span>
                <p><strong>{benefitTitle}</strong>{description}</p>
              </div>
            ))}
          </div>
          <small>PRODUTO <span>→</span> IDEIA <span>→</span> PLANO <span>→</span> REC</small>
        </aside>
        <section className="auth-shell" aria-live="polite">
        <div className="auth-accent" aria-hidden="true"></div>
        {(panel === "login" || panel === "signup") && (
          <div className="auth-tabs" role="tablist" aria-label="Acesso à conta">
            <button type="button" role="tab" aria-selected={panel === "login"} onClick={() => switchPanel("login")}>Entrar</button>
            <button type="button" role="tab" aria-selected={panel === "signup"} onClick={() => switchPanel("signup")}>Criar conta</button>
          </div>
        )}
        <div id="login-heading" className="auth-heading">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{sub}</p>
        </div>

        {panel === "login" && (
          <form className="stack auth-form" onSubmit={handleLogin}>
            <ProviderButtons dividerLabel="ou entre com email" busy={busy} busyProvider={busyProvider} onSelect={(id) => void continueWithProvider(id)} />
            <label>
              Email
              <input id="email" name="email" type="email" required autoComplete="email" inputMode="email" spellCheck={false} placeholder="seu@email.com" />
            </label>
            <label>
              Senha
              <PasswordInput id="password" autoComplete="current-password" placeholder="Sua senha" />
            </label>
            <div className="form-row">
              <span></span>
              <button className="text-button" type="button" onClick={() => switchPanel("recovery")}>
                Esqueci minha senha
              </button>
            </div>
            <button className="primary" type="submit" disabled={busy || busyProvider !== null}>
              {busy ? busyLabel : "Entrar"}
            </button>
            <p className="auth-switch">
              Ainda não tem uma conta?{" "}
              <button className="text-button" type="button" onClick={() => switchPanel("signup")}>
                Criar conta grátis
              </button>
            </p>
          </form>
        )}

        {panel === "signup" && (
          <form className="stack auth-form" onSubmit={handleSignup}>
            <ProviderButtons dividerLabel="ou crie com email" busy={busy} busyProvider={busyProvider} onSelect={(id) => void continueWithProvider(id)} />
            <label>
              Nome
              <input id="signup-name" name="signup-name" required minLength={2} maxLength={120} autoComplete="name" placeholder="Como podemos chamar você?" />
            </label>
            <label>
              Email
              <input id="signup-email" name="signup-email" type="email" required autoComplete="email" inputMode="email" spellCheck={false} placeholder="seu@email.com" />
            </label>
            <label>
              Senha
              <div onChangeCapture={(event) => setSignupPassword((event.target as HTMLInputElement).value)}>
                <PasswordInput id="signup-password" autoComplete="new-password" placeholder="Mínimo de 6 caracteres" />
              </div>
              <span className={`password-help${signupPassword.length >= 6 ? " is-valid" : ""}`}>
                {signupPassword.length >= 6 ? "✓ Senha pronta para usar" : "Use pelo menos 6 caracteres"}
              </span>
            </label>
            <button className="primary" type="submit" disabled={busy || busyProvider !== null}>
              {busy ? busyLabel : "Começar agora"}
            </button>
            <p className="legal-note">
              Ao continuar, você concorda com nossos <Link href="/termos" target="_blank" rel="noopener">Termos</Link> e{" "}
              <Link href="/privacidade" target="_blank" rel="noopener">Política de Privacidade</Link>.
            </p>
            <p className="auth-switch">
              Já tem uma conta?{" "}
              <button className="text-button" type="button" onClick={() => switchPanel("login")}>
                Entrar
              </button>
            </p>
          </form>
        )}

        {panel === "recovery" && (
          <form className="stack auth-form" onSubmit={handleRecovery}>
            <label>
              Email
              <input id="recovery-email" name="recovery-email" type="email" required autoComplete="email" inputMode="email" spellCheck={false} placeholder="seu@email.com" />
            </label>
            <button className="primary" type="submit" disabled={busy}>
              {busy ? busyLabel : "Enviar link"}
            </button>
            <button className="back-button" type="button" onClick={() => switchPanel("login")}>
              Voltar para entrar
            </button>
          </form>
        )}

        {panel === "reset" && (
          <form className="stack auth-form" onSubmit={handleReset}>
            <label>
              Nova senha
              <PasswordInput id="new-password" autoComplete="new-password" />
            </label>
            <label>
              Confirmar senha
              <PasswordInput id="confirm-password" autoComplete="new-password" />
            </label>
            <button className="primary" type="submit" disabled={busy}>
              {busy ? busyLabel : "Salvar nova senha"}
            </button>
          </form>
        )}

        {(error || recoveryHint) && panel === "reset" && !error && (
          <p className="form-message error" role="alert">{recoveryHint}</p>
        )}
        {error && <p className="form-message error" role="alert">{error}</p>}
        {notice && <p className="form-message success" role="status">{notice}</p>}
        </section>
      </div>
      <Link className="back-home" href="/">Voltar para o início</Link>
    </main>
  );
}
