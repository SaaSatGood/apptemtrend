"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type LoginLinkProps = {
  href?: string;
  className?: string;
  children: ReactNode;
  onNavigate?: () => void;
};

/**
 * Link de entrada ("Entrar"). A sessão fica persistida no navegador: quem já
 * está logado entra direto no app, sem precisar fazer login de novo.
 */
export default function LoginLink({
  href = "/descobrir",
  className,
  children,
  onNavigate,
}: LoginLinkProps) {
  return (
    <Link href={href} className={className} onClick={() => onNavigate?.()}>
      {children}
    </Link>
  );
}
