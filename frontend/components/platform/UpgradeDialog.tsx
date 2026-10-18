"use client";

import Link from "next/link";
import Modal from "./Modal";

/** Intercepta o limite no momento do valor: mensagem do backend + CTA de upgrade. */
export default function UpgradeDialog({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <Modal titleId="upgrade-plan-title" onClose={onClose}>
      <div className="stack">
        <p className="eyebrow">Limite do plano</p>
        <h2 id="upgrade-plan-title">Hora de crescer de plano?</h2>
        <p className="muted">{message}</p>
        <div className="upgrade-dialog-actions">
          <Link className="primary" href="/planos" onClick={onClose}>
            Ver os planos
          </Link>
          <button className="ghost" type="button" onClick={onClose}>
            Continuar no atual
          </button>
        </div>
      </div>
    </Modal>
  );
}
