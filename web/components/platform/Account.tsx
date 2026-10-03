"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { api, friendlyError } from "@/lib/api";
import { usePlatform } from "./store";

interface AccountData {
  nome: string;
  email: string | null;
  plan?: { nome?: string; status?: string };
}

export default function Account({ onEditPreferences }: { onEditPreferences: () => void }) {
  const { toast, me } = usePlatform();
  const [account, setAccount] = useState<AccountData | null>(null);
  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [savingPass, setSavingPass] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase().auth.getSession();
        const data_ = await api<AccountData>("/account", data.session?.access_token);
        if (!cancelled) {
          setAccount(data_);
          setName(data_.nome || "");
        }
      } catch {
        if (!cancelled) toast("Não conseguimos carregar as configurações.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const preferences = [
    ...(me?.creator?.estilos_conteudo || []),
    ...(me?.creator?.temas_interesse || []),
  ];

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
      toast("Nome atualizado.");
    } catch (error) {
      toast(friendlyError(error, "Não conseguimos concluir agora. Tente novamente."));
    } finally {
      setSavingName(false);
    }
  }

  async function savePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
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
    e.currentTarget.reset();
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
      } catch {
        /* noop */
      }
      window.location.replace("/app?deleted=1");
    } catch (error) {
      setDeleteError(friendlyError(error, "Não conseguimos concluir agora. Tente novamente."));
      setDeleting(false);
    }
  }

  return (
    <section id="account-view">
      <div className="hero-row">
        <div>
          <p className="eyebrow">MINHA CONTA</p>
          <h1>Configurações da conta</h1>
          <p className="muted">Gerencie seus dados de acesso e veja o plano da sua conta.</p>
        </div>
        <Link className="ghost" href="/app">
          Voltar
        </Link>
      </div>
      <div className="settings-grid">
        <div className="card">
          <h2>Perfil</h2>
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
            </label>
            <button className="primary" type="submit" disabled={savingName}>
              {savingName ? "Salvando..." : "Salvar nome"}
            </button>
          </form>
        </div>
        <div className="card">
          <h2>Plano ativo</h2>
          <div className="plan-card">
            <strong>{account?.plan?.nome || "Plano gratuito"}</strong>
            <span className="status">{account?.plan?.status === "ativo" ? "Ativo" : "Inativo"}</span>
            <p className="muted">Seu acesso atual não possui cobrança ou assinatura recorrente.</p>
          </div>
        </div>
        <div className="card">
          <h2>Preferências</h2>
          <p className="muted">
            {preferences.length
              ? preferences.join(" · ")
              : "Você ainda não selecionou temas ou formatos de conteúdo."}
          </p>
          <button className="ghost" type="button" onClick={onEditPreferences}>
            Atualizar preferências
          </button>
        </div>
        <div className="card">
          <h2>Alterar senha</h2>
          <form className="stack" onSubmit={savePassword}>
            <label>
              Nova senha
              <input name="new-password" type="password" required minLength={6} />
            </label>
            <label>
              Confirmar nova senha
              <input name="confirm-password" type="password" required minLength={6} />
            </label>
            <button className="primary" type="submit" disabled={savingPass}>
              {savingPass ? "Salvando..." : "Atualizar senha"}
            </button>
          </form>
        </div>
        <div className="card danger-card">
          <h2>Excluir conta</h2>
          <p className="muted">Esta ação remove permanentemente sua conta, perfil e conteúdos salvos.</p>
          <button className="danger-button" type="button" onClick={() => { setDeleteError(""); setConfirmOpen(true); }}>
            Excluir minha conta
          </button>
        </div>
      </div>
      {confirmOpen && (
        <dialog className="publication-dialog" open>
          <div className="stack">
            <p className="eyebrow">EXCLUIR CONTA</p>
            <h2>Excluir sua conta?</h2>
            <p className="muted">Essa ação é permanente e remove sua conta, perfil e conteúdos salvos. Não pode ser desfeita.</p>
            {deleteError && <p className="form-message error" role="alert">{deleteError}</p>}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="danger-button" type="button" disabled={deleting} onClick={confirmDelete}>
                {deleting ? "Excluindo..." : "Confirmar exclusão"}
              </button>
              <button className="ghost" type="button" onClick={() => setConfirmOpen(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </dialog>
      )}
    </section>
  );
}
