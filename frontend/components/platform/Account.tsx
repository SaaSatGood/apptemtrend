"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { api, friendlyError } from "@/lib/api";
import { usePlatform } from "./store";
import Modal from "./Modal";

interface AccountData {
  nome: string;
  email: string | null;
  plan?: { nome?: string; status?: string };
}

export default function Account({ onEditPreferences }: { onEditPreferences: () => void }) {
  const { toast, me, signOut, reloadMe } = usePlatform();
  const [account, setAccount] = useState<AccountData | null>(null);
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [accountError, setAccountError] = useState(false);
  const [name, setName] = useState("");
  const [voz, setVoz] = useState(me?.creator?.voz_exemplo || "");
  const [savingName, setSavingName] = useState(false);
  const [savingVoice, setSavingVoice] = useState(false);
  const [savingPass, setSavingPass] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const loadAccount = useCallback(async () => {
    setLoadingAccount(true);
    setAccountError(false);
    try {
      const { data } = await supabase().auth.getSession();
      const loaded = await api<AccountData>("/account", data.session?.access_token);
      setAccount(loaded);
      setName(loaded.nome || "");
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

  const preferences = [
    ...(me?.creator?.estilos_conteudo || []),
    ...(me?.creator?.temas_interesse || []),
  ];
  const savedVoz = me?.creator?.voz_exemplo || "";
  const voiceChanged = voz.trim() !== savedVoz.trim();

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) setVoz(savedVoz);
    });
    return () => {
      active = false;
    };
  }, [savedVoz]);
  const nameChanged = Boolean(account && name.trim() !== account.nome.trim());

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast("O nome deve ter pelo menos 2 caracteres.");
      return;
    }
    if (trimmed.length > 120) {
      toast("O nome deve ter no máximo 120 caracteres.");
      return;
    }
    setSavingName(true);
    try {
      const { data } = await supabase().auth.getSession();
      await api("/account/profile", data.session?.access_token, {
        method: "PATCH",
        body: JSON.stringify({ nome: trimmed }),
      });
      await supabase().auth.refreshSession();
      setAccount((current) => (current ? { ...current, nome: trimmed } : current));
      toast("Nome atualizado.");
    } catch (error) {
      toast(friendlyError(error, "Não conseguimos concluir agora. Tente novamente."));
    } finally {
      setSavingName(false);
    }
  }

  async function saveVoice(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = voz.trim().slice(0, 500);
    setSavingVoice(true);
    try {
      const { data } = await supabase().auth.getSession();
      await api("/account/profile", data.session?.access_token, {
        method: "PATCH",
        body: JSON.stringify({ nome: name.trim() || account?.nome || "", voz_exemplo: trimmed }),
      });
      await reloadMe();
      toast(trimmed ? "Sua voz foi salva. Roteiros novos saem no seu jeito ✓" : "Sua voz foi removida.");
    } catch (error) {
      toast(friendlyError(error, "Não conseguimos salvar sua voz. Tente novamente."));
    } finally {
      setSavingVoice(false);
    }
  }

  async function savePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formElement = e.currentTarget;
    const form = new FormData(formElement);
    const password = String(form.get("new-password"));
    if (password.length < 6) {
      toast("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== String(form.get("confirm-password"))) {
      toast("As senhas não conferem.");
      return;
    }
    setSavingPass(true);
    const { error } = await supabase().auth.updateUser({ password });
    setSavingPass(false);
    if (error) {
      toast(friendlyError(error, "Não conseguimos atualizar sua senha. Tente novamente."));
      return;
    }
    formElement.reset();
    toast("Senha atualizada com sucesso.");
  }

  async function confirmDelete() {
    if (deleting) return;
    setDeleting(true);
    try {
      const { data } = await supabase().auth.getSession();
      await api("/account", data.session?.access_token, { method: "DELETE" });
      await supabase().auth.signOut({ scope: "local" });
      try {
        window.localStorage.removeItem("temtrend_onboarding");
        if (me?.user_id) window.localStorage.removeItem(`temtrend_onboarding:${me.user_id}`);
      } catch {
        /* noop */
      }
      window.location.replace("/app?deleted=1");
    } catch (error) {
      setDeleteError(friendlyError(error, "Não conseguimos concluir agora. Tente novamente."));
      setDeleting(false);
    }
  }

  if (!account) {
    return <section id="account-view" className="account-view">
      <div className="account-heading"><div><p className="eyebrow">Minha conta</p><h1>Minha <em>conta.</em></h1></div></div>
      {loadingAccount ? <div className="empty-state" role="status"><h2>Carregando seu perfil…</h2><p>Estamos buscando suas preferências e configurações.</p></div> : accountError ? <div className="empty-state" role="alert"><h2>Não conseguimos carregar sua conta.</h2><p>Suas configurações continuam salvas. Tente novamente.</p><button className="primary" type="button" onClick={() => void loadAccount()}>Tentar novamente</button></div> : null}
    </section>;
  }

  return (
    <section id="account-view" className="account-view">
      <div className="account-heading">
        <div>
          <p className="eyebrow">Minha conta</p>
          <h1>Minha <em>conta.</em></h1>
          <p className="muted">Atualize seu perfil, personalização e segurança em um só lugar.</p>
        </div>
        {me?.is_admin && <Link className="ghost" href="/app/admin">← Voltar ao painel</Link>}
      </div>
      <div className="account-summary">
        <span className="account-avatar" aria-hidden="true">{(name || account?.email || "T").trim().charAt(0).toUpperCase()}</span>
        <div>
          <strong>{account?.nome || "Carregando seu perfil..."}</strong>
          <span>{account?.email || ""}</span>
        </div>
        <span className="account-plan-pill">{account?.plan?.nome || "Plano gratuito"}</span>
      </div>
      <div className="account-layout">
        <div className="account-main">
        <section className="card account-card">
          <div className="account-card-heading">
            <div><h2>Informações do perfil</h2><p>Como seu nome aparece na plataforma.</p></div>
          </div>
          <form className="stack" onSubmit={saveName}>
            <label>
              Nome de usuário
              <input
                value={name}
                minLength={2}
                maxLength={120}
                required
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              Email
              <input type="email" disabled value={account?.email || ""} />
              <small>O email é usado para entrar na sua conta e não pode ser alterado aqui.</small>
            </label>
            {nameChanged || savingName ? <button className="primary account-save" type="submit" disabled={savingName}>
              {savingName ? "Salvando..." : "Salvar alterações"}
            </button> : <p className="account-saved-status" role="status">Dados atualizados ✓</p>}
          </form>
        </section>
        <section className="card account-card">
          <div className="account-card-heading">
            <div><h2>Segurança</h2><p>Defina uma nova senha para sua conta.</p></div>
          </div>
          <form className="stack" onSubmit={savePassword}>
            <div className="account-password-grid">
              <label>
                Nova senha
                <input name="new-password" type="password" autoComplete="new-password" required minLength={6} placeholder="Mínimo de 6 caracteres" />
              </label>
              <label>
                Confirmar nova senha
                <input name="confirm-password" type="password" autoComplete="new-password" required minLength={6} placeholder="Digite novamente" />
              </label>
            </div>
            <button className="ghost account-save" type="submit" disabled={savingPass}>
              {savingPass ? "Atualizando senha..." : "Atualizar senha"}
            </button>
          </form>
        </section>
        </div>
        <aside className="account-sidebar">
        {account?.plan?.nome && <section className="card account-card account-plan-card">
          <p className="eyebrow">Plano atual</p>
          <div className="plan-card">
            <div><strong>{account?.plan?.nome || "Plano gratuito"}</strong><span className="status">{account?.plan?.status === "ativo" ? "Ativo" : "Inativo"}</span></div>
            <p className="muted">Acesso à descoberta de produtos e criação de conteúdo, sem cobrança recorrente.</p>
          </div>
        </section>}
        {!me?.is_admin && (
          <section id="preferencias" className="card account-card account-preferences">
            <div className="account-card-heading compact">
              <div><h2>Preferências de conteúdo</h2><p>Seus temas aparecem como atalhos de busca em Descobrir.</p></div>
            </div>
            {preferences.length ? <div className="account-preference-list">{preferences.map((preference) => <span key={preference}>{preference}</span>)}</div> : <p className="muted">Você ainda não selecionou temas ou formatos de conteúdo.</p>}
            <button className="ghost" type="button" onClick={onEditPreferences}>
              Editar preferências →
            </button>
          </section>
        )}
        {!me?.is_admin && (
          <section id="voz" className="card account-card account-voice">
            <div className="account-card-heading compact">
              <div><h2>Sua voz</h2><p>Roteiros novos saem no seu jeito de falar.</p></div>
            </div>
            <form className="stack" onSubmit={saveVoice}>
              <label>
                Como você fala nos vídeos? (opcional)
                <textarea
                  rows={4}
                  maxLength={500}
                  placeholder="Ex.: Gente, preciso mostrar isso pra vocês..."
                  value={voz}
                  onChange={(e) => setVoz(e.target.value)}
                />
              </label>
              <small className="muted">{voz.trim().length} de 500 caracteres</small>
              {voiceChanged || savingVoice ? <button className="ghost account-save" type="submit" disabled={savingVoice}>
                {savingVoice ? "Salvando..." : "Salvar minha voz"}
              </button> : <p className="account-saved-status" role="status">Voz atualizada ✓</p>}
            </form>
          </section>
        )}
        </aside>
      </div>
      <button className="ghost account-signout" type="button" onClick={() => void signOut()}>Sair da conta</button>
        <section className="card danger-card account-danger">
          <div><h2>Excluir conta</h2><p className="muted">Remove permanentemente seu perfil e todos os conteúdos salvos.</p></div>
          <button className="danger-button" type="button" onClick={() => { setDeleteError(""); setConfirmOpen(true); }}>
            Excluir minha conta
          </button>
        </section>
      {confirmOpen && (
        <Modal titleId="delete-account-title" busy={deleting} onClose={() => setConfirmOpen(false)}>
          <div className="stack">
            <p className="eyebrow">Excluir conta</p>
            <h2 id="delete-account-title">Excluir sua conta?</h2>
            <p className="muted">Essa ação é permanente e remove sua conta, perfil e conteúdos salvos. Não pode ser desfeita.</p>
            {deleteError && <p className="form-message error" role="alert">{deleteError}</p>}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="danger-button" type="button" disabled={deleting} onClick={confirmDelete}>
                {deleting ? "Excluindo..." : "Confirmar exclusão"}
              </button>
              <button className="ghost" type="button" disabled={deleting} onClick={() => setConfirmOpen(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
