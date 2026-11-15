"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { hasRecoveryIntent } from "@/lib/supabase";

/**
 * O link de recuperação do Supabase cai na Site URL (a landing), não na casca
 * do app. Se detectamos a intenção de recuperação já no carregamento do módulo,
 * levamos a pessoa para o app, onde a tela "Nova senha" é montada.
 */
export default function RecoveryRedirect() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname !== "/" || !hasRecoveryIntent()) return;
    router.replace("/descobrir");
  }, [pathname, router]);

  return null;
}
