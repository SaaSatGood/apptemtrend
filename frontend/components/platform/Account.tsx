"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { resolveSession, supabase } from "@/lib/supabase";
import { api, friendlyError } from "@/lib/api";
import { usePlatform } from "./store";
import Modal from "./Modal";
import type { BillingSubscriptionSummary } from "@/lib/types";
import { displayPlanName } from "@/lib/plan-display";

interface AccountData {
  nome: string;
  email: string | null;
  provider?: string | null;
  plan?: {
    nome?: string;
    status?: string;
    billing?: boolean;
    trial_ends_at?: string | null;
    current_period_end?: string | null;
  };
}

const PLAN_STATUS_LABEL: Record<string, string> = {
  active: "Ativo",
  trialing: "Grátis",
  canceled: "Cancelado",
  past_due: "Pagamento pendente",
  inactive: "Grátis",
};

function planStatusLabel(status?: string): string {
  return PLAN_STATUS_LABEL[status ?? ""] ?? "Ativo";
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function Account() {
  const searchParams = useSearchParams();
  const { toast, me, signOut, reloadMe } = usePlatform();
  const [account, setAccount] = useState<AccountData | null>(null);
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [accountError, setAccountError] = useState(false);
  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [savingPass, setSavingPass] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [billing, setBilling] = useState<BillingSubscriptionSummary | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [checkoutStatus, setCheckoutStatus] = useState<"idle" | "checking" | "confirmed" | "pending">(
    searchParams.get("checkout") === "ok" ? "checking" : "idle"
  );
  const [profileSaved, setProfileSaved] = useState(false);
  const [passwordDirty, setPasswordDirty] = useState(false);
  const profileFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!profileSaved) return;
    const timer = setTimeout(() => setProfileSaved(false), 4000);
    return () => clearTimeout(timer);
  }, [profileSaved]);

  const loadAccount = useCallback(async () => {
    setLoadingAccount(true);
    setAccountError(false);
    try {
      const session = await resolveSession();
      const loaded = await api<AccountData>("/account", session?.access_token);
      setAccount(loaded);
      setName(loaded.nome || "");
      if (loaded.plan?.billing) {
        try {
          const summary = await api<BillingSubscriptionSummary>(
            "/billing/subscription",
            session?.access_token
          );
          if (summary?.enabled) setBilling(summary);
        } catch {
          /* card cai no estado estático */
        }
      }
    } catch {
      setAccountError(true);
    } finally {
      setLoadingAccount(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void loadAccount(); });
    return () => { active = false; };
  }, [loadAccount]);

  useEffect(() => {
    if (searchParams.get("checkout") !== "ok") return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    const checkPayment = async () => {
      try {
        const session = await resolveSession();
        if (!session?.access_token) return;
        const summary = await api<BillingSubscriptionSummary>("/billing/subscription", session.access_token);
        if (!active) return;
        if (summary?.enabled) setBilling(summary);
        if (summary?.has_active_subscription && summary.status === "active") {
          setCheckoutStatus("confirmed");
          window.history.replaceState(null, "", "/conta");
          await reloadMe().catch(() => undefined);
          return;
        }
      } catch {
        // O retorno do checkout pode chegar alguns segundos antes do webhook.
      }
      attempt += 1;
      if (active && attempt < 6) timer = setTimeout(() => void checkPayment(), 2000);
      else if (active) setCheckoutStatus("pending");
    };
    void checkPayment();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [reloadMe, searchParams]);

  const nameChanged = Boolean(account && name.trim() !== account.nome.trim());
  const hasActiveBilling = Boolean(billing?.has_active_subscription);
  const needsPasswordToDelete = account?.provider === "email";
  // Barra fixa de ações: qualquer campo editado (nome ou senha) habilita salvar/descartar.
  const dirty = nameChanged || passwordDirty;

  async function persistName(trimmed: string): Promise<boolean> {
    setSavingName(true);
    try {
      const { data } = await supabase().auth.getSession();
      await api("/account/profile", data.session?.access_token, {
        method: "PATCH",
        body: JSON.stringify({ nome: trimmed }),
      });
      await supabase().auth.refreshSession();
      setAccount((current) => (current ? { ...current, nome: trimmed } : current));
      setProfileSaved(true);
      toast("Nome atualizado.");
      return true;
    } catch (error) {
      toast(friendlyError(error, "Não conseguimos concluir agora. Tente novamente."));
      return false;
    } finally {
      setSavingName(false);
    }
  }

  async function persistPassword(currentPassword: string, password: string): Promise<boolean> {
    setSavingPass(true);
    try {
      const { data } = await supabase().auth.getSession();
      await api("/account/password", data.session?.access_token, {
        method: "POST",
        body: JSON.stringify({ current_password: currentPassword, new_password: password }),
      });
      toast("Senha atualizada com sucesso.");
      return true;
    } catch (error) {
      toast(friendlyError(error, "Não conseguimos atualizar sua senha. Tente novamente."));
      return false;
    } finally {
      setSavingPass(false);
    }
  }

  async function saveChanges(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingName || savingPass) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const currentPassword = String(form.get("current-password") ?? "");
    const password = String(form.get("new-password") ?? "");
    const confirmPassword = String(form.get("confirm-password") ?? "");
    const wantsPassword = Boolean(currentPassword || password || confirmPassword);
    const trimmed = name.trim();

    if (nameChanged) {
      if (trimmed.length < 2) {
        toast("O nome deve ter pelo menos 2 caracteres.");
        return;
      }
      if (trimmed.length > 120) {
        toast("O nome deve ter no máximo 120 caracteres.");
        return;
      }
    }
    if (wantsPassword) {
      if (!currentPassword) {
        toast("Informe sua senha atual para confirmar a troca.");
        return;
      }
      if (password.length < 8) {
        toast("A nova senha precisa ter pelo menos 8 caracteres.");
        return;
      }
      if (password !== confirmPassword) {
        toast("As senhas não conferem.");
        return;
      }
      if (password === currentPassword) {
        toast("A nova senha precisa ser diferente da atual.");
        return;
      }
    }
    if (!nameChanged && !wantsPassword) return;

    let ok = true;
    if (nameChanged) ok = await persistName(trimmed);
    if (ok && wantsPassword) ok = await persistPassword(currentPassword, password);
    if (ok && wantsPassword) {
      formElement.querySelectorAll<HTMLInputElement>('input[type="password"]').forEach((input) => {
        input.value = "";
      });
      setPasswordDirty(false);
    }
  }

  function discardChanges() {
    setName(account?.nome ?? "");
    setProfileSaved(false);
    profileFormRef.current?.reset();
    setPasswordDirty(false);
  }

  function markPasswordDirty(event: React.ChangeEvent<HTMLInputElement>) {
    const form = event.currentTarget.form;
    if (!form) return;
    const data = new FormData(form);
    setPasswordDirty(Boolean(
      String(data.get("current-password") ?? "")
      || String(data.get("new-password") ?? "")
      || String(data.get("confirm-password") ?? "")
    ));
  }

  async function confirmDelete() {
    if (
      deleting ||
      deleteConfirmation.trim().toLocaleLowerCase("pt-BR") !== account?.email?.toLocaleLowerCase("pt-BR") ||
      (needsPasswordToDelete && !deletePassword)
    ) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const { data } = await supabase().auth.getSession();
      await api("/account", data.session?.access_token, {
        method: "DELETE",
        body: JSON.stringify({
          confirm_email: deleteConfirmation.trim(),
          ...(needsPasswordToDelete ? { current_password: deletePassword } : {}),
        }),
      });
      await supabase().auth.signOut({ scope: "local" });
      try {
        window.localStorage.removeItem("temtrend_onboarding");
        if (me?.user_id) window.localStorage.removeItem(`temtrend_onboarding:${me.user_id}`);
      } catch {
        /* noop */
      }
      window.location.replace("/descobrir?deleted=1");
    } catch (error) {
      setDeleteError(friendlyError(error, "Não conseguimos concluir agora. Tente novamente."));
      setDeleting(false);
    }
  }

  async function confirmCancelPlan() {
    if (cancelBusy) return;
    setCancelBusy(true);
    setCancelError("");
    try {
      const { data } = await supabase().auth.getSession();
      await api("/billing/cancel", data.session?.access_token, { method: "POST" });
      toast("Assinatura cancelada. Você mantém o acesso até o fim do período pago.");
      setCancelOpen(false);
      await loadAccount();
      await reloadMe();
    } catch (error) {
      setCancelError(friendlyError(error, "Não conseguimos cancelar agora. Tente novamente."));
    } finally {
      setCancelBusy(false);
    }
  }

  if (!account) {
    return <section id="account-view" className="account-view">
      <div className="account-heading"><div><p className="eyebrow">Minha conta</p><h1>Minha <span className="tt-hl">conta.</span></h1></div></div>
      {loadingAccount ? <div className="empty-state" role="status"><h2>Carregando seu perfil…</h2><p>Estamos buscando suas preferências e configurações.</p></div> : accountError ? <div className="empty-state" role="alert"><h2>Não conseguimos carregar sua conta.</h2><p>Suas configurações continuam salvas. Tente novamente.</p><button className="primary" type="button" onClick={() => void loadAccount()}>Tentar novamente</button></div> : null}
    </section>;
  }

  const usage = billing?.usage;
  const isFree = billing?.plan === "free";
  const searchesUsed = isFree ? usage?.searches_week ?? 0 : usage?.searches_today ?? 0;
  const kitsUsed = usage ? (isFree ? usage.kits_week ?? 0 : usage.kits_month) : 0;
  const searchesLimit = usage?.searches_limit ?? null;
  const kitsLimit = usage?.kits_limit ?? null;
  const searchesPercent = searchesLimit ? Math.min(100, Math.round((searchesUsed / searchesLimit) * 100)) : null;
  const kitsPercent = kitsLimit ? Math.min(100, Math.round((kitsUsed / kitsLimit) * 100)) : null;
  const planName = displayPlanName(billing?.plan_label ?? account?.plan?.nome);
  const periodEnd = billing?.current_period_end ?? account?.plan?.current_period_end ?? null;

  return (
    <section id="account-view" className="acct">
      <header className="acct-head account-heading">
        <p className="eyebrow">Minha conta</p>
        <h1>Minha <span className="tt-hl">conta</span></h1>
        <p className="muted">Perfil, plano e segurança em um só lugar.</p>
      </header>
      {checkoutStatus !== "idle" && (
        <div className={`form-message ${checkoutStatus === "confirmed" ? "success" : ""}`} role="status">
          {checkoutStatus === "checking" && "Pagamento recebido. Estamos confirmando a ativação do seu plano…"}
          {checkoutStatus === "confirmed" && "Pagamento confirmado — seu plano já está ativo."}
          {checkoutStatus === "pending" && (
            <>Seu pagamento ainda está sendo processado. Você pode atualizar esta página em instantes ou falar com o <Link href="/suporte">suporte</Link>.</>
          )}
        </div>
      )}
      <div className="acct-identity card">
        <span className="acct-avatar" aria-hidden="true">{(name || account.email || "T").trim().charAt(0).toUpperCase()}</span>
        <div className="acct-identity-copy">
          <span className="acct-identity-name">
            <strong>{account.nome || account.email || "Sua conta"}</strong>
            <span className="acct-plan-badge">{planName}</span>
          </span>
          <small>{account.email}</small>
        </div>
        <div className="acct-identity-actions">
          {me?.is_admin && <Link className="ghost" href="/admin">Painel</Link>}
          <button className="ghost account-signout" type="button" onClick={() => void signOut()}>Sair da conta</button>
        </div>
      </div>

      {account.plan?.nome && (
        <section id="plano" className="acct-plan">
          <div className="acct-plan-main">
            <span className="acct-plan-name">
              <strong>Plano {planName}</strong>
              <span className="acct-plan-status">{planStatusLabel(account.plan.status)}</span>
            </span>
            {periodEnd ? (
              <>
                <p className="acct-plan-date">{fmtDate(periodEnd)}</p>
                <p className="acct-plan-note">
                  {billing?.status === "canceled" || billing?.cancel_at_period_end
                    ? "Acesso até · assinatura cancelada"
                    : billing?.payment_mode === "one_time"
                      ? "Pagamento por período · sem renovação automática"
                      : billing?.has_active_subscription
                        ? "Renova em · assinatura ativa"
                        : "Acesso concedido · sem cobrança recorrente"}
                </p>
              </>
            ) : (
              <p className="acct-plan-note">
                {planName === "Grátis"
                  ? "100 buscas e 10 roteiros por semana. Conheça o Pro para criar sem contar."
                  : "Acesso ativo — sem data de renovação registrada."}
              </p>
            )}
            {billing?.launch_price && (
              <p className="acct-plan-note is-accent">Preço de lançamento mantido — R$ 39,90/mês ou R$ 399/ano.</p>
            )}
            {billing?.pending_plan_label && (
              <p className="acct-plan-note is-accent">Mudança para <b>{billing.pending_plan_label}</b> no próximo ciclo.</p>
            )}
            <div className="acct-plan-actions">
              <Link className="acct-plan-cta" href="/conta/planos">
                {billing?.renewal_due ? "Renovar acesso" : "Gerenciar plano"}
              </Link>
              {billing?.has_active_subscription && !billing?.cancel_at_period_end && (
                <button className="acct-plan-cancel" type="button" onClick={() => { setCancelError(""); setCancelOpen(true); }}>
                  Cancelar assinatura
                </button>
              )}
            </div>
          </div>
          <div className="acct-plan-metrics">
            <div className="acct-metric">
              <strong>{searchesPercent != null ? `${searchesPercent}%` : "∞"}</strong>
              <span>{isFree ? "buscas usadas · renova toda segunda" : "buscas usadas hoje"}</span>
            </div>
            <div className="acct-metric">
              <strong>{kitsPercent != null ? `${kitsPercent}%` : "∞"}</strong>
              <span>{isFree ? "roteiros usados · renova toda segunda" : "roteiros usados no mês"}</span>
            </div>
          </div>
        </section>
      )}

      <form className="acct-grid" ref={profileFormRef} onSubmit={(event) => void saveChanges(event)}>
        <section id="perfil" className="card acct-card">
          <div className="account-card-heading">
            <div><h2>Informações do perfil</h2><p>Como seu nome aparece na plataforma.</p></div>
          </div>
          <div className="stack">
            <label>
              Nome de usuário
              <input
                name="display-name"
                autoComplete="name"
                value={name}
                minLength={2}
                maxLength={120}
                required
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              Email
              <input name="account-email" type="email" autoComplete="email" disabled value={account?.email || ""} />
              <small>Este email é usado para entrar. Para alterá-lo, <Link href="/suporte">fale com o suporte</Link>.</small>
            </label>
            {profileSaved && <p className="account-saved-status" role="status">Dados atualizados ✓</p>}
          </div>
        </section>
        <section id="seguranca" className="card acct-card">
          <div className="account-card-heading">
            <div><h2>Segurança</h2><p>Confirme sua senha atual para definir uma nova.</p></div>
          </div>
          {account.provider && account.provider !== "email" ? (
            <p className="muted">Sua conta entra com {account.provider}. A senha é gerenciada pelo provedor de login.</p>
          ) : (
            <div className="stack" onChange={markPasswordDirty}>
              <label>
                Senha atual
                <input name="current-password" type="password" autoComplete="current-password" placeholder="Sua senha atual" onChange={markPasswordDirty} />
              </label>
              <div className="account-password-grid">
                <label>
                  Nova senha
                  <input name="new-password" type="password" autoComplete="new-password" minLength={8} placeholder="Mínimo de 8 caracteres" onChange={markPasswordDirty} />
                </label>
                <label>
                  Confirmar nova senha
                  <input name="confirm-password" type="password" autoComplete="new-password" minLength={8} placeholder="Digite novamente" onChange={markPasswordDirty} />
                </label>
              </div>
              <button className="ghost account-save" type="submit" disabled={savingPass}>
                {savingPass ? "Atualizando senha…" : "Atualizar senha"}
              </button>
            </div>
          )}
        </section>
      </form>

      <section className="card acct-danger">
        <div>
          <h2>Excluir conta</h2>
          <p className="muted">Remove permanentemente seu perfil e todos os conteúdos salvos.</p>
        </div>
        <button className="danger-button" type="button" onClick={() => { setDeleteError(""); setDeleteConfirmation(""); setDeletePassword(""); setConfirmOpen(true); }}>
          Excluir minha conta
        </button>
      </section>

      {dirty && (
        <div className="acct-savebar" role="status" aria-live="polite">
          <span>Alterações não salvas</span>
          <div className="acct-savebar-actions">
            <button className="acct-savebar-discard" type="button" onClick={discardChanges}>
              Descartar
            </button>
            <button
              className="acct-savebar-save"
              type="button"
              disabled={savingName || savingPass}
              onClick={() => profileFormRef.current?.requestSubmit()}
            >
              {savingName || savingPass ? "Salvando…" : "Salvar alterações"}
            </button>
          </div>
        </div>
      )}
      {confirmOpen && (
        <Modal titleId="delete-account-title" busy={deleting} onClose={() => setConfirmOpen(false)}>
          <div className="stack">
            <p className="eyebrow">Excluir conta</p>
            <h2 id="delete-account-title">Excluir sua conta?</h2>
            <p className="muted">Essa ação é permanente e remove sua conta, perfil e conteúdos salvos. Não pode ser desfeita.</p>
            {hasActiveBilling && <p className="form-message">Sua assinatura ativa será cancelada no provedor antes da exclusão e o acesso encerra imediatamente.</p>}
            <label>Digite seu email para confirmar<input type="email" autoComplete="off" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} /></label>
            {needsPasswordToDelete && (
              <label>
                Senha atual
                <input type="password" autoComplete="current-password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} />
              </label>
            )}
            {deleteError && <p className="form-message error" role="alert">{deleteError}</p>}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="danger-button" type="button" disabled={deleting || deleteConfirmation.trim().toLocaleLowerCase("pt-BR") !== account?.email?.toLocaleLowerCase("pt-BR") || (needsPasswordToDelete && !deletePassword)} onClick={confirmDelete}>
                {deleting ? "Excluindo..." : "Confirmar exclusão"}
              </button>
              <button className="ghost" type="button" disabled={deleting} onClick={() => setConfirmOpen(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </Modal>
      )}
      {cancelOpen && (
        <Modal titleId="cancel-plan-title" busy={cancelBusy} onClose={() => setCancelOpen(false)}>
          <div className="stack">
            <p className="eyebrow">Cancelar assinatura</p>
            <h2 id="cancel-plan-title">Cancelar seu plano?</h2>
            <p className="muted">
              Você mantém tudo liberado até o fim do período já pago
              {billing?.current_period_end ? <> (<b>{fmtDate(billing.current_period_end)}</b>)</> : ""}. Depois, para voltar
              a criar, é só reassinar — nada é apagado.
            </p>
            <p className="muted">
              Se a primeira compra foi feita há menos de 7 dias, você pode exercer o direito de arrependimento e
              receber o valor de volta — veja a <Link href="/reembolso">Política de Reembolso</Link>.
            </p>
            {cancelError && <p className="form-message error" role="alert">{cancelError}</p>}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="danger-button" type="button" disabled={cancelBusy} onClick={confirmCancelPlan}>
                {cancelBusy ? "Cancelando..." : "Confirmar cancelamento"}
              </button>
              <button className="ghost" type="button" disabled={cancelBusy} onClick={() => setCancelOpen(false)}>
                Manter assinatura
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
