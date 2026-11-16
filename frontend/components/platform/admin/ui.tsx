"use client";

import type { ReactNode } from "react";
import styles from "../Admin.module.css";

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className={styles.sectionHeading}>
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {action ?? (description ? <p>{description}</p> : null)}
    </div>
  );
}

export function LoadingRows({ count = 5 }: { count?: number }) {
  return (
    <div className={styles.listSkeleton} role="status" aria-label="Carregando">
      {Array.from({ length: count }).map((_, index) => (
        <i key={index} />
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className={styles.errorState} role="alert">
      <strong>{message}</strong>
      {onRetry ? (
        <button type="button" onClick={onRetry}>
          Tentar novamente
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  onAction,
}: {
  title: string;
  description?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className={styles.emptyState}>
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {action && onAction ? (
        <button type="button" onClick={onAction}>
          {action}
        </button>
      ) : null}
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  onChange,
  total,
  label,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  total: number;
  label: string;
}) {
  return (
    <div className={styles.pagination}>
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Anterior
      </button>
      <span>
        Página <strong>{page}</strong> de {totalPages} · {label} {total}
      </span>
      <button type="button" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        Próxima
      </button>
    </div>
  );
}
