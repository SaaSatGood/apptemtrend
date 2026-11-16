"use client";

import Link from "next/link";
import { usePlatform } from "@/components/platform/store";

export default function AdminPage() {
  const { admin, meLoading } = usePlatform();

  // Em /admin o AppShell monta o painel para administradores; aqui só
  // tratamos quem não tem permissão.
  if (admin) return null;

  // Sem "Acesso negado" enquanto o perfil ainda está carregando: quem é admin
  // via um Flash de erro em conexões lentas.
  if (meLoading) {
    return (
      <div className="app-boot" role="status" aria-live="polite">
        <div className="app-boot-brand"><span aria-hidden="true">T</span><b>TemTrend</b></div>
        <p>Verificando seu acesso…</p>
        <div className="app-boot-bar" aria-hidden="true"><i /></div>
      </div>
    );
  }

  return (
    <div className="empty-state">
      <h3>Acesso negado.</h3>
      <p>Sua conta não tem permissão de administração.</p>
      <Link className="primary" href="/descobrir">Voltar para o painel</Link>
    </div>
  );
}
