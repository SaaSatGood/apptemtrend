"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { humanAuthError } from "@/lib/api";

type Panel = "login" | "signup" | "recovery" | "reset";

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
        minLength={8}
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
  const [googleBusy, setGoogleBusy] = useState(false);
  const [signupPassword, setSignupPassword] = useState("");

  const [eyebrow, title, sub] = COPY[panel];

  function switchPanel(next: Panel) {
    setError("");
    setNotice("");
    setPanel(next);
  }

  async function continueWithGoogle() {
    setGoogleBusy(true);
    const { error } = await supabase().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
    if (error) {
      setError(humanAuthError(error));
      setGoogleBusy(false);
    }
  }

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError("");
    setBusy(true);
    setBusyLabel("Entrando...");
    const { error } = await supabase().auth.signInWithPassword({
      email: String(form.get("email")).trim().toLowerCase(),
      password: String(form.get("password")),
    });
    setBusy(false);
    if (error) {
      setError(humanAuthError(error));
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
    setBusy(false);
    if (error) {
      setError(humanAuthError(error));
      return;
    }
    if (data.session) {
      onAuthenticated();
      return;
    }
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
    if (password.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
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
            <button className="google-button" type="button" onClick={continueWithGoogle} disabled={googleBusy}>
              <span className="google-icon" aria-hidden="true">G</span>
              {googleBusy ? "Conectando..." : "Continuar com Google"}
            </button>
            <div className="divider"><span>ou entre com email</span></div>
            <label>
              Email
              <input id="email" name="email" type="email" required autoComplete="email" inputMode="email" placeholder="seu@email.com" autoFocus />
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
            <button className="primary" type="submit" disabled={busy}>
              {busy ? busyLabel : "Entrar →"}
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
            <button className="google-button" type="button" onClick={continueWithGoogle} disabled={googleBusy}>
              <span className="google-icon" aria-hidden="true">G</span>
              {googleBusy ? "Conectando..." : "Continuar com Google"}
            </button>
            <div className="divider"><span>ou crie com email</span></div>
            <label>
              Nome
              <input id="signup-name" name="signup-name" required minLength={2} maxLength={120} autoComplete="name" placeholder="Como podemos chamar você?" autoFocus />
            </label>
            <label>
              Email
              <input id="signup-email" name="signup-email" type="email" required autoComplete="email" inputMode="email" placeholder="seu@email.com" />
            </label>
            <label>
              Senha
              <div onChangeCapture={(event) => setSignupPassword((event.target as HTMLInputElement).value)}>
                <PasswordInput id="signup-password" autoComplete="new-password" placeholder="Mínimo de 8 caracteres" />
              </div>
              <span className={`password-help${signupPassword.length >= 8 ? " is-valid" : ""}`}>
                {signupPassword.length >= 8 ? "✓ Senha pronta para usar" : "Use pelo menos 8 caracteres"}
              </span>
            </label>
            <button className="primary" type="submit" disabled={busy}>
              {busy ? busyLabel : "Começar agora →"}
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
              <input id="recovery-email" name="recovery-email" type="email" required autoComplete="email" inputMode="email" placeholder="seu@email.com" autoFocus />
            </label>
            <button className="primary" type="submit" disabled={busy}>
              {busy ? busyLabel : "Enviar link →"}
            </button>
            <button className="back-button" type="button" onClick={() => switchPanel("login")}>
              ← Voltar para entrar
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
              {busy ? busyLabel : "Salvar nova senha →"}
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
      <Link className="back-home" href="/">← Voltar para o início</Link>
    </main>
  );
}
