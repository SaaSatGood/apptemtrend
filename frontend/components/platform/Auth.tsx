"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import HighlightedTitle from "./HighlightedTitle";
import TemtrendArt from "./TemtrendArt";
import { supabase } from "@/lib/supabase";
import { api, friendlyError, humanAuthError } from "@/lib/api";
import { track } from "@/lib/track";

type Panel = "login" | "signup" | "verify" | "recovery" | "reset";
type OAuthProvider = "google";

const PROVIDERS: Array<{ id: OAuthProvider; label: string }> = [
  { id: "google", label: "Continuar com Google" },
];

const COPY: Record<Panel, [string, string, string]> = {
  login: ["Boas-vindas à TemTrend", "Comece a vender.", "Entre para continuar de onde parou."],
  signup: ["Sua conta grátis", "Comece a vender.", "Crie sua conta e monte seu primeiro plano."],
  verify: [
    "Confirme seu e-mail",
    "Digite o código.",
    "Enviamos um código de 6 dígitos. Ele expira em 10 minutos.",
  ],
  recovery: [
    "Recuperar acesso",
    "Esqueceu sua senha?",
    "Digite seu e-mail e enviamos um código de 6 dígitos para criar uma nova senha.",
  ],
  reset: ["Nova senha", "Crie uma nova senha.", "Digite o código que chegou no seu e-mail e escolha a nova senha."],
};

function ProviderIcon() {
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
            <ProviderIcon />
            <span className="provider-label">{busyProvider === id ? "Conectando..." : label}</span>
          </button>
        ))}
      </div>
      <div className="divider"><span>{dividerLabel}</span></div>
    </>
  );
}

const AUTH_SLIDES: Array<{ kicker: string; title: string; emphasis: string; text: string }> = [
  {
    kicker: "Do produto ao vídeo",
    title: "Descubra, planeje",
    emphasis: "e grave sem travar.",
    text: "Escolha o produto, receba o plano em 8 partes e acompanhe a gravação até a publicação.",
  },
  {
    kicker: "Escolha com dados",
    title: "Um produto certo",
    emphasis: "muda o seu mês.",
    text: "Comissão, concorrência e potencial de venda na mesma tela para decidir sem achismo.",
  },
  {
    kicker: "Roteiro pronto",
    title: "Grave cena a cena,",
    emphasis: "sem improvisar.",
    text: "Receba o plano completo e siga do primeiro take ao CTA para o TikTok Shop.",
  },
  {
    kicker: "Sua produção",
    title: "Do salvo ao publicado,",
    emphasis: "no mesmo lugar.",
    text: "Acompanhe cada vídeo e veja o que já está gravado, pronto ou no ar.",
  },
];

function AuthPreview() {
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      setSlide((current) => (current + 1) % AUTH_SLIDES.length);
    }, 5600);
    return () => window.clearInterval(id);
  }, []);

  const active = AUTH_SLIDES[slide];

  return (
    <aside className="auth-value tt-auth-preview" aria-hidden="true">
      <div className="tt-auth-art">
        <TemtrendArt idPrefix="tt-auth" />
      </div>

      <div className="tt-auth-caption">
        <div className="tt-auth-slides" key={slide}>
          <span className="tt-auth-caption-kicker">{active.kicker}</span>
          <h2>
            {active.title} <em>{active.emphasis}</em>
          </h2>
          <p>{active.text}</p>
        </div>
        <div className="tt-auth-dots">
          {AUTH_SLIDES.map((item, index) => (
            <i key={item.kicker} className={index === slide ? "is-active" : undefined} />
          ))}
        </div>
      </div>
    </aside>
  );
}

export default function AuthPanel({
  initialPanel,
  recoveryHint,
  onAuthenticated,
  onRecoveryDone,
  onExitRecovery,
}: {
  initialPanel: Panel;
  recoveryHint: string | null;
  onAuthenticated: () => void;
  onRecoveryDone?: () => void;
  onExitRecovery?: () => void;
}) {
  const [panel, setPanel] = useState<Panel>(initialPanel);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyProvider, setBusyProvider] = useState<OAuthProvider | null>(null);
  const [signupPassword, setSignupPassword] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeBusy, setCodeBusy] = useState(false);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  // Senha fica em memória só o suficiente para entrar logo após confirmar o
  // código. Nunca vai para storage; some ao trocar de tela.
  const passwordRef = useRef("");
  const codeInputRef = useRef<HTMLInputElement | null>(null);

  const [eyebrow, title, sub] = COPY[panel];

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = window.setTimeout(() => setResendIn((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [resendIn]);

  useEffect(() => {
    if (panel === "verify" || (panel === "reset" && pendingEmail)) codeInputRef.current?.focus();
  }, [panel, pendingEmail]);

  function switchPanel(next: Panel) {
    setError("");
    setNotice("");
    setPanel(next);
    if (next !== "verify") {
      setCode("");
      setResendState("idle");
    }
    if (next !== "reset") setResetPasswordValue("");
  }

  function beginVerify(email: string, message = "") {
    setPendingEmail(email);
    setCode("");
    setError("");
    setNotice(message);
    setResendState("idle");
    setResendIn(60);
    setPanel("verify");
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

  async function sendCodeTo(email: string): Promise<boolean> {
    if (!email) return false;
    try {
      await api("/auth/resend-code", undefined, {
        method: "POST",
        body: JSON.stringify({ email }),
        timeoutMs: 20000,
      });
      setResendIn(60);
      return true;
    } catch (err) {
      setError(friendlyError(err, "Não conseguimos reenviar o código agora. Tente novamente em instantes."));
      return false;
    }
  }

  async function requestNewCode(): Promise<boolean> {
    return sendCodeTo(pendingEmail);
  }

  async function handleResendCode() {
    if (resendIn > 0 || resendState === "sending") return;
    setError("");
    setNotice("");
    setResendState("sending");
    const sent = await requestNewCode();
    setResendState(sent ? "sent" : "error");
    if (sent) setNotice(`Enviamos um novo código para ${pendingEmail}.`);
  }

  async function waitForSession(timeoutMs = 2500): Promise<boolean> {
    // A sessão é persistida no navegador: o signIn resolve antes do cliente
    // interno disponibilizá-la em alguns navegadores. Aguarda até ela
    // aparecer no getSession em vez de presumir login.
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
    const email = String(form.get("email")).trim().toLowerCase();
    const password = String(form.get("password"));
    setError("");
    setNotice("");
    setBusy(true);
    setBusyLabel("Entrando...");
    const { data, error } = await supabase().auth.signInWithPassword({ email, password });
    if (error) {
      // Conta criada mas ainda sem e-mail confirmado: leva direto para o
      // código, reenviando um novo, em vez de deixar o usuário num beco.
      if (String(error.message).toLowerCase().includes("email not confirmed")) {
        passwordRef.current = password;
        setBusy(false);
        beginVerify(email);
        const sent = await sendCodeTo(email);
        if (sent) setNotice(`Enviamos um código de confirmação para ${email}.`);
        return;
      }
      setBusy(false);
      setError(humanAuthError(error));
      return;
    }
    if (!data.session) {
      setBusy(false);
      setError("Confirme seu email antes de entrar.");
      return;
    }
    const persisted = await waitForSession();
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
    const email = String(form.get("signup-email")).trim().toLowerCase();
    const password = String(form.get("signup-password"));
    if (nome.length < 2) {
      setError("Informe seu nome com pelo menos 2 caracteres.");
      return;
    }
    if (password.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    setError("");
    setNotice("");
    setBusy(true);
    setBusyLabel("Criando sua conta...");
    try {
      // A conta nasce sem sessão: só entra depois de confirmar o código
      // enviado por e-mail. Assim o onboarding nunca abre sem e-mail válido.
      await api("/auth/signup", undefined, {
        method: "POST",
        body: JSON.stringify({ nome, email, password }),
        timeoutMs: 25000,
      });
    } catch (err) {
      setBusy(false);
      setError(friendlyError(err, "Não conseguimos criar sua conta agora. Tente novamente em instantes."));
      return;
    }
    setBusy(false);
    passwordRef.current = password;
    setSignupPassword("");
    track("signup_confirm_email");
    beginVerify(email);
  }

  async function handleVerify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const token = code.replace(/\D/g, "");
    if (token.length !== 6) {
      setError("Digite os 6 dígitos do código.");
      return;
    }
    setError("");
    setNotice("");
    setCodeBusy(true);
    try {
      await api("/auth/verify-code", undefined, {
        method: "POST",
        body: JSON.stringify({ email: pendingEmail, code: token }),
        timeoutMs: 20000,
      });
    } catch (err) {
      setCodeBusy(false);
      setError(friendlyError(err, "Não conseguimos confirmar o código. Tente novamente."));
      return;
    }

    track("email_verified", { method: "code" });

    // Confirmação ok: entra sozinho quando a senha do cadastro ainda está em
    // memória. Se o usuário recarregou a página, volta ao login com aviso.
    const password = passwordRef.current;
    if (password) {
      const { data, error } = await supabase().auth.signInWithPassword({
        email: pendingEmail,
        password,
      });
      if (!error && data.session && (await waitForSession())) {
        passwordRef.current = "";
        setCodeBusy(false);
        setPendingEmail("");
        track("signup_complete", { method: "code" });
        onAuthenticated();
        return;
      }
    }

    passwordRef.current = "";
    setCodeBusy(false);
    setCode("");
    setResendIn(0);
    switchPanel("login");
    setNotice("E-mail confirmado. Entre com sua senha para continuar.");
  }

  async function handleRecovery(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("recovery-email")).trim().toLowerCase();
    setError("");
    setNotice("");
    setBusy(true);
    setBusyLabel("Enviando código...");
    try {
      await api("/auth/password/request", undefined, {
        method: "POST",
        body: JSON.stringify({ email }),
        timeoutMs: 20000,
      });
    } catch (err) {
      setBusy(false);
      setError(friendlyError(err, "Não conseguimos enviar o código agora. Tente novamente em instantes."));
      return;
    }
    setBusy(false);
    setPendingEmail(email);
    setCode("");
    setResetPasswordValue("");
    setResendState("idle");
    setResendIn(60);
    setPanel("reset");
    setNotice(
      "Se este e-mail tiver uma conta com senha, enviamos um código de 6 dígitos. Contas criadas com Google devem entrar com Google."
    );
  }

  async function handleResendReset() {
    if (!pendingEmail || resendIn > 0 || resendState === "sending") return;
    setError("");
    setNotice("");
    setResendState("sending");
    try {
      await api("/auth/password/request", undefined, {
        method: "POST",
        body: JSON.stringify({ email: pendingEmail }),
        timeoutMs: 20000,
      });
      setResendState("sent");
      setResendIn(60);
      setNotice("Se houver uma conta com senha para este e-mail, enviamos um novo código.");
    } catch (err) {
      setResendState("error");
      setError(friendlyError(err, "Não conseguimos reenviar o código agora. Tente novamente em instantes."));
    }
  }

  async function handleReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("new-password"));
    if (password.length < 8) {
      setError("A nova senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== String(form.get("confirm-password"))) {
      setError("As senhas não conferem.");
      return;
    }

    // Fluxo por código (recomendado). O modo legado por link só continua
    // aceito para contas de e-mail/senha, nunca para contas Google.
    if (pendingEmail) {
      const token = code.replace(/\D/g, "");
      if (token.length !== 6) {
        setError("Digite os 6 dígitos do código.");
        return;
      }
      setError("");
      setNotice("");
      setCodeBusy(true);
      setBusyLabel("Salvando...");
      try {
        await api("/auth/password/reset", undefined, {
          method: "POST",
          body: JSON.stringify({ email: pendingEmail, code: token, password }),
          timeoutMs: 20000,
        });
      } catch (err) {
        setCodeBusy(false);
        setError(friendlyError(err, "Não conseguimos salvar sua nova senha. Tente novamente."));
        return;
      }

      // Entra direto com a senha nova; se não der, volta ao login.
      const { data, error } = await supabase().auth.signInWithPassword({
        email: pendingEmail,
        password,
      });
      if (!error && data.session && (await waitForSession())) {
        setCodeBusy(false);
        setPendingEmail("");
        setResetPasswordValue("");
        track("password_reset_complete");
        onRecoveryDone?.();
        onAuthenticated();
        return;
      }

      setCodeBusy(false);
      setPendingEmail("");
      setResetPasswordValue("");
      switchPanel("login");
      setNotice("Senha atualizada. Entre com sua nova senha.");
      return;
    }

    // Link antigo de recuperação (ainda aceito para contas com senha).
    setError("");
    setBusy(true);
    setBusyLabel("Salvando...");
    const { data: sessionData } = await supabase().auth.getSession();
    const provider = sessionData.session?.user.app_metadata?.provider;
    const identities = sessionData.session?.user.identities ?? [];
    const hasEmailIdentity = identities.some((identity) => identity.provider === "email");
    if (provider && provider !== "email" && !hasEmailIdentity) {
      setBusy(false);
      setError("Esta conta usa login com Google. Entre com o Google para acessar sua conta.");
      return;
    }
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
    onRecoveryDone?.();
    switchPanel("login");
    setNotice("Senha atualizada. Entre para continuar.");
  }

  return (
    <main id="login-view" className={`auth-view tt-auth${panel === "signup" || panel === "verify" ? " auth-view--signup" : ""}`}>
      <div className="auth-layout">
        <section className="auth-shell" aria-live="polite">
        <Link className="auth-logo" href="/" aria-label="Voltar para a página inicial">
          <span aria-hidden="true" /><b>TemTrend</b>
        </Link>
        <div className="auth-accent" aria-hidden="true"></div>
        {(panel === "login" || panel === "signup") && (
          <div className="auth-tabs" role="tablist" aria-label="Acesso à conta">
            <button type="button" role="tab" aria-selected={panel === "login"} onClick={() => switchPanel("login")}>Entrar</button>
            <button type="button" role="tab" aria-selected={panel === "signup"} onClick={() => switchPanel("signup")}>Criar conta</button>
          </div>
        )}
        <div id="login-heading" className="auth-heading">
          <p className="eyebrow">{eyebrow}</p>
          <h1><HighlightedTitle text={title} /></h1>
          <p>{sub}</p>
        </div>

        {panel === "login" && (
          <form className="stack auth-form" onSubmit={handleLogin}>
            <ProviderButtons dividerLabel="Ou entre com e-mail" busy={busy} busyProvider={busyProvider} onSelect={(id) => void continueWithProvider(id)} />
            <label>
              E-mail de acesso
              <input id="email" name="email" type="email" required autoComplete="email" inputMode="email" spellCheck={false} placeholder="seu@email.com" defaultValue={pendingEmail || undefined} />
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
            <p className="legal-note">
              Ao entrar, você concorda com nossos <Link href="/termos" target="_blank" rel="noopener">Termos</Link> e{" "}
              <Link href="/privacidade" target="_blank" rel="noopener">Política de Privacidade</Link>.
            </p>
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
            <ProviderButtons dividerLabel="Ou crie com e-mail" busy={busy} busyProvider={busyProvider} onSelect={(id) => void continueWithProvider(id)} />
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
            <ul className="signup-assurances" aria-label="O que você recebe ao criar a conta">
              <li><Icon name="check" size={12} strokeWidth={2.6} /> Comece grátis</li>
              <li><Icon name="check" size={12} strokeWidth={2.6} /> Pronto em 1 minuto</li>
            </ul>
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

        {panel === "verify" && (
          <form className="stack auth-form auth-code-form" onSubmit={handleVerify}>
            <div className="auth-code-target" role="status">
              <span>Enviamos o código para</span>
              <strong>{pendingEmail}</strong>
            </div>
            <label htmlFor="verify-code">
              Código de confirmação
              <input
                ref={codeInputRef}
                id="verify-code"
                name="verify-code"
                className="code-input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                placeholder="000000"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                aria-describedby="verify-code-help"
              />
            </label>
            <p id="verify-code-help" className="auth-code-help">
              O código vale por 10 minutos. Confira também a pasta de spam.
            </p>
            <button className="primary" type="submit" disabled={codeBusy || code.length !== 6}>
              {codeBusy ? "Confirmando..." : "Confirmar código"}
            </button>
            <div className="auth-code-actions">
              <button
                className="text-button"
                type="button"
                onClick={() => void handleResendCode()}
                disabled={resendIn > 0 || resendState === "sending" || codeBusy}
              >
                {resendState === "sending"
                  ? "Reenviando..."
                  : resendIn > 0
                    ? `Reenviar em ${resendIn}s`
                    : "Reenviar código"}
              </button>
              <button className="back-button" type="button" onClick={() => switchPanel("signup")}>
                Trocar e-mail
              </button>
            </div>
          </form>
        )}

        {panel === "recovery" && (
          <form className="stack auth-form" onSubmit={handleRecovery}>
            <label>
              Email da conta
              <input id="recovery-email" name="recovery-email" type="email" required autoComplete="email" inputMode="email" spellCheck={false} placeholder="seu@email.com" />
            </label>
            <p className="auth-code-help">
              Enviamos um código de 6 dígitos. Contas criadas com Google não usam senha: nelas, entre com o Google.
            </p>
            <button className="primary" type="submit" disabled={busy}>
              {busy ? busyLabel : "Enviar código"}
            </button>
            <button className="back-button" type="button" onClick={() => switchPanel("login")}>
              Voltar para entrar
            </button>
          </form>
        )}

        {panel === "reset" && (
          <form className="stack auth-form" onSubmit={handleReset}>
            {pendingEmail && (
              <div className="auth-code-target" role="status">
                <span>Código enviado para</span>
                <strong>{pendingEmail}</strong>
              </div>
            )}
            {notice && (
              <p className="form-message success" role="status">{notice}</p>
            )}
            {error && (
              <p className="form-message error" role="alert">{error}</p>
            )}
            {pendingEmail && (
              <label htmlFor="reset-code">
                Código de confirmação
                <input
                  ref={codeInputRef}
                  id="reset-code"
                  name="reset-code"
                  className="code-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  placeholder="000000"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  aria-describedby="reset-code-help"
                />
              </label>
            )}
            {pendingEmail && (
              <p id="reset-code-help" className="auth-code-help">
                O código vale por 10 minutos. Se não chegar, confira o spam.
              </p>
            )}
            <label>
              Nova senha
              <div onChangeCapture={(event) => setResetPasswordValue((event.target as HTMLInputElement).value)}>
                <PasswordInput id="new-password" autoComplete="new-password" placeholder="Mínimo de 8 caracteres" />
              </div>
              <span className={`password-help${resetPasswordValue.length >= 8 ? " is-valid" : ""}`}>
                {resetPasswordValue.length >= 8 ? "✓ Senha pronta para usar" : "Use pelo menos 8 caracteres"}
              </span>
            </label>
            <label>
              Confirmar senha
              <PasswordInput id="confirm-password" autoComplete="new-password" placeholder="Repita a nova senha" />
            </label>
            <button
              className="primary"
              type="submit"
              disabled={codeBusy || busy || (Boolean(pendingEmail) && code.length !== 6)}
            >
              {codeBusy || busy ? busyLabel : "Salvar nova senha"}
            </button>
            {pendingEmail && (
              <div className="auth-code-actions">
                <button
                  className="text-button"
                  type="button"
                  onClick={() => void handleResendReset()}
                  disabled={resendIn > 0 || resendState === "sending" || codeBusy}
                >
                  {resendState === "sending"
                    ? "Reenviando..."
                    : resendIn > 0
                      ? `Reenviar em ${resendIn}s`
                      : "Reenviar código"}
                </button>
                <button className="back-button" type="button" onClick={() => switchPanel("recovery")}>
                  Trocar e-mail
                </button>
              </div>
            )}
            <button
              className="back-button"
              type="button"
              onClick={() => {
                onExitRecovery?.();
                switchPanel("login");
              }}
            >
              Voltar para entrar
            </button>
          </form>
        )}

        {(error || recoveryHint) && panel === "reset" && !error && (
          <p className="form-message error" role="alert">{recoveryHint}</p>
        )}
        {error && panel !== "reset" && <p className="form-message error" role="alert">{error}</p>}
        {notice && panel !== "reset" && <p className="form-message success" role="status">{notice}</p>}
        </section>
      </div>
      <AuthPreview />
      <Link className="back-home" href="/"><Icon name="arrow-left" size={14} /> Voltar para o início</Link>
    </main>
  );
}
