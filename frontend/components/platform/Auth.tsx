"use client";

import { useState } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import { supabase } from "@/lib/supabase";
import { humanAuthError } from "@/lib/api";
import { track } from "@/lib/track";

type Panel = "login" | "signup" | "recovery" | "reset";
type OAuthProvider = "google" | "facebook" | "apple";

const PROVIDERS: Array<{ id: OAuthProvider; label: string }> = [
  { id: "google", label: "Continuar com Google" },
  { id: "facebook", label: "Continuar com Facebook" },
  { id: "apple", label: "Continuar com Apple" },
];

const COPY: Record<Panel, [string, string, string]> = {
  login: ["Boas-vindas à TemTrend", "Comece a vender.", "Entre para continuar de onde parou."],
  signup: ["Sua conta grátis", "Comece a vender.", "Crie sua conta e monte seu primeiro plano."],
  recovery: [
    "Recuperar acesso",
    "Esqueceu sua senha?",
    "Digite seu email e enviaremos um link para criar uma nova senha.",
  ],
  reset: ["Nova senha", "Crie uma nova senha.", "Escolha uma senha segura para continuar."],
};

function ProviderIcon({ id }: { id: OAuthProvider }) {
  if (id === "google") {
    return (
      <span className="tt-provider-icon tt-provider-icon-google" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.9-1.75 2.98-4.33 2.98-7.35Z" />
          <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.42l-3.24-2.5c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.06v2.58A10 10 0 0 0 12 22Z" />
          <path fill="#FBBC05" d="M6.41 13.92A6.02 6.02 0 0 1 6.1 12c0-.67.11-1.32.31-1.92V7.5H3.06A10 10 0 0 0 2 12c0 1.61.39 3.14 1.06 4.5l3.35-2.58Z" />
          <path fill="#EA4335" d="M12 5.96c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.94 5.5l3.35 2.58C7.2 7.72 9.4 5.96 12 5.96Z" />
        </svg>
      </span>
    );
  }
  if (id === "facebook") {
    return (
      <span className="tt-provider-icon tt-provider-icon-facebook" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path fill="#1877F2" d="M24 12a12 12 0 1 0-13.88 11.85v-8.38H7.08V12h3.04V9.36c0-3 1.79-4.67 4.53-4.67 1.31 0 2.69.24 2.69.24v2.95h-1.52c-1.49 0-1.96.93-1.96 1.88V12h3.33l-.53 3.47h-2.8v8.38A12 12 0 0 0 24 12Z" />
          <path fill="#fff" d="M16.67 15.47 17.2 12h-3.33V9.76c0-.95.47-1.88 1.96-1.88h1.52V4.93s-1.38-.24-2.69-.24c-2.74 0-4.53 1.67-4.53 4.67V12H7.08v3.47h3.04v8.38a12.1 12.1 0 0 0 3.75 0v-8.38h2.8Z" />
        </svg>
      </span>
    );
  }
  return (
    <span className="tt-provider-icon tt-provider-icon-apple" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="currentColor" focusable="false">
        <path d="M16.7 12.9c0-2.5 2-3.7 2.1-3.8-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.3 1.9 2.7 3.3 2.6 1.3-.1 1.8-.9 3.4-.9s2.1.9 3.5.9c1.4 0 2.4-1.3 3.3-2.6 1-1.5 1.4-3 1.4-3.1-.1 0-3.4-1.3-3.4-4.1Z" />
        <path d="M14.3 5.6c.7-.9 1.2-2.1 1.1-3.3-1.1 0-2.4.7-3.1 1.6-.7.8-1.3 2-1.1 3.2 1.2.1 2.4-.6 3.1-1.5Z" />
      </svg>
    </span>
  );
}

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
            <ProviderIcon id={id} />
            <span className="provider-label">{busyProvider === id ? "Conectando..." : label}</span>
            <span className="provider-label-short" aria-hidden="true">{id === "google" ? "Google" : id === "facebook" ? "Facebook" : "Apple"}</span>
          </button>
        ))}
      </div>
      <div className="divider"><span>{dividerLabel}</span></div>
    </>
  );
}

function AuthPreview() {
  return (
    <aside className="auth-value tt-auth-preview" aria-hidden="true">
      <div className="tt-auth-window">
        <div className="tt-auth-rail">
          <span className="tt-auth-rail-mark">T</span>
          <span className="tt-auth-rail-icon is-active">
            <Icon name="grid" size={15} />
          </span>
          <span className="tt-auth-rail-icon">
            <Icon name="search" size={15} />
          </span>
          <span className="tt-auth-rail-icon">
            <Icon name="file-text" size={15} />
          </span>
          <span className="tt-auth-rail-icon">
            <Icon name="dashboard" size={15} />
          </span>
          <span className="tt-auth-rail-icon">
            <Icon name="settings" size={15} />
          </span>
          <span className="tt-auth-rail-avatar">R</span>
        </div>

        <div className="tt-auth-screen">
          <div className="tt-auth-screen-top">
            <div className="tt-auth-screen-title">
              <span>Painel de criação</span>
              <strong>Visão geral</strong>
            </div>
            <div className="tt-auth-periods">
              <span>Hoje</span>
              <span className="is-active">Este mês</span>
            </div>
          </div>

          <div className="tt-auth-metrics">
            <div className="tt-auth-metric">
              <span>Produtos salvos</span>
              <strong>128</strong>
              <small>+12%</small>
            </div>
            <div className="tt-auth-metric">
              <span>Planos prontos</span>
              <strong>36</strong>
              <small>+8%</small>
            </div>
            <div className="tt-auth-metric is-highlight">
              <span>Vídeos publicados</span>
              <strong>24</strong>
              <small>+6%</small>
            </div>
          </div>

          <div className="tt-auth-chart">
            <div className="tt-auth-chart-head">
              <span>Desempenho da produção</span>
              <b>Últimos 30 dias</b>
            </div>
            <svg className="tt-auth-chart-svg" viewBox="0 0 720 190" preserveAspectRatio="none" focusable="false">
              <defs>
                <linearGradient id="tt-auth-chart-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#9eea6c" stopOpacity=".46" />
                  <stop offset="100%" stopColor="#9eea6c" stopOpacity="0" />
                </linearGradient>
              </defs>
              <g className="tt-auth-chart-grid">
                <line x1="0" y1="45" x2="720" y2="45" />
                <line x1="0" y1="95" x2="720" y2="95" />
                <line x1="0" y1="145" x2="720" y2="145" />
              </g>
              <path
                className="tt-auth-chart-area"
                d="M0 146 C48 142 72 128 108 132 C144 136 166 108 208 112 C250 116 274 86 314 92 C354 98 386 70 430 78 C474 86 500 48 548 56 C596 64 630 30 720 34 L720 190 L0 190 Z"
                fill="url(#tt-auth-chart-fill)"
              />
              <path
                className="tt-auth-chart-line"
                d="M0 146 C48 142 72 128 108 132 C144 136 166 108 208 112 C250 116 274 86 314 92 C354 98 386 70 430 78 C474 86 500 48 548 56 C596 64 630 30 720 34"
                pathLength={1}
                fill="none"
                stroke="#58c411"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <circle className="tt-auth-chart-dot" cx="548" cy="56" r="6" fill="#fff" stroke="#58c411" strokeWidth="3" />
            </svg>
            <div className="tt-auth-chart-days">
              <span>01 jun</span>
              <span>08 jun</span>
              <span>15 jun</span>
              <span>22 jun</span>
              <span>30 jun</span>
            </div>
          </div>

          <div className="tt-auth-bottom">
            <div className="tt-auth-plan-card">
              <div className="tt-auth-plan-head">
                <span>Plano de gravação</span>
                <b>8 partes</b>
              </div>
              <strong>Garrafa térmica no dia a dia</strong>
              <ul>
                <li><i>01</i><span>Abertura com o produto em uso</span></li>
                <li><i>02</i><span>Prova real: gelo por 12 horas</span></li>
                <li><i>03</i><span>CTA para o link do TikTok Shop</span></li>
              </ul>
            </div>
            <div className="tt-auth-evolution-card">
              <div>
                <span>Evolução</span>
                <strong>+18%</strong>
              </div>
              <div className="tt-auth-bars" aria-hidden="true">
                <i /><i /><i /><i /><i /><i /><i /><i />
              </div>
              <small>vs. mês anterior</small>
            </div>
          </div>
        </div>
      </div>

      <div className="tt-auth-caption">
        <span className="tt-auth-caption-kicker">Tudo em um só lugar</span>
        <h2>Do produto ao vídeo, <em>sem começar do zero.</em></h2>
        <p>Encontre oportunidades, receba o plano de gravação e acompanhe sua produção.</p>
        <div className="tt-auth-dots"><i className="is-active" /><i /><i /></div>
      </div>
    </aside>
  );
}

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
  const [pendingEmail, setPendingEmail] = useState("");
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent" | "error">("idle");

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
      options: { redirectTo: window.location.origin + window.location.pathname + window.location.search },
    });
    if (error) {
      setError(humanAuthError(error));
      setBusyProvider(null);
    }
  }

  async function resendConfirmation() {
    if (!pendingEmail || resendState === "sending") return;
    setResendState("sending");
    const { error } = await supabase().auth.resend({ type: "signup", email: pendingEmail });
    setResendState(error ? "error" : "sent");
  }

  async function waitForPersistedSession(timeoutMs = 2500): Promise<boolean> {
    // A sessão vive só em memória (persistSession: false): o signIn resolve
    // antes do cliente interno disponibilizá-la em alguns navegadores.
    // Aguarda até ela aparecer no getSession em vez de presumir login.
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
      setError("Entramos na sua conta, mas o navegador ainda não confirmou a sessão. Recarregue a página para continuar.");
      return;
    }
    setPendingEmail("");
    track("login_complete", { method: "password" });
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
        setError("Conta criada, mas o navegador ainda não confirmou a sessão. Recarregue a página para continuar.");
        return;
      }
      track("signup_complete");
      onAuthenticated();
      return;
    }
    setBusy(false);
    track("signup_confirm_email");
    setPendingEmail(String(form.get("signup-email")).trim().toLowerCase());
    switchPanel("login");
    setNotice("Conta criada. Falta confirmar seu e-mail.");
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
    <main id="login-view" className={`auth-view tt-auth${panel === "signup" ? " auth-view--signup" : ""}`}>
      <Link className="auth-logo" href="/" aria-label="Voltar para a página inicial">
        <span aria-hidden="true" /><b>TemTrend</b>
      </Link>
      <div className="auth-layout">
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

        {panel === "login" && pendingEmail && (
          <div className="auth-confirm" role="status">
            <p>
              <strong>Falta confirmar seu e-mail.</strong> Enviamos o link para <b>{pendingEmail}</b>. Confira a caixa de entrada e o spam.
            </p>
            <button
              className="ghost"
              type="button"
              onClick={() => void resendConfirmation()}
              disabled={resendState === "sending"}
            >
              {resendState === "sending" ? "Reenviando..." : resendState === "sent" ? "E-mail reenviado ✓" : "Reenviar e-mail"}
            </button>
            {resendState === "error" && (
              <p className="form-message error" role="alert">Não conseguimos reenviar agora. Tente de novo em alguns instantes.</p>
            )}
          </div>
        )}

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
              {busy ? busyLabel : "Criar conta grátis"}
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
        <AuthPreview />
      </div>
      <Link className="back-home" href="/"><Icon name="arrow-left" size={14} /> Voltar para o início</Link>
    </main>
  );
}
