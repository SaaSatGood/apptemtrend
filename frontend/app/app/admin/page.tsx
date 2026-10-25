"use client";

import Link from "next/link";
import { usePlatform } from "@/components/platform/store";

export default function AdminPage() {
  const { admin } = usePlatform();

  // Em /app/admin o AppShell monta o painel para administradores; aqui só
  // tratamos quem não tem permissão.
  if (admin) return null;

  return (
    <div className="empty-state">
      <h3>Acesso negado.</h3>
      <p>Sua conta não tem permissão de administração.</p>
      <Link className="primary" href="/app">Voltar para o painel</Link>
    </div>
  );
}
