"use client";

import Link from "next/link";
import Icon from "@/components/ui/Icon";
import Modal from "./Modal";

/**
 * Intercepta o limite no momento do valor: mensagem do backend + CTA de
 * upgrade. O plano Grátis tem dois tipos de cota — buscas (chat) e roteiros —
 * e o diálogo se adapta ao recurso que acabou.
 */
export default function UpgradeDialog({ message, onClose }: { message: string; onClose: () => void }) {
  const freeSearchLimit = message.match(/usou\s+(?:a|as)\s+(\d+)\s+(?:pesquisas?|buscas?)/i);
  const freeKitLimit = message.match(/usou\s+(?:o|os)\s+(\d+)\s+roteiros?/i);
  const isFreeSearch = Boolean(freeSearchLimit);
  const isFreeKit = !isFreeSearch && Boolean(freeKitLimit);
  const limit = Number((freeSearchLimit ?? freeKitLimit)?.[1] ?? 0);

  const title = isFreeSearch
    ? "Suas buscas gratuitas acabaram."
    : isFreeKit
      ? "Seus roteiros gratuitos acabaram."
      : "Limite do plano atingido.";

  const description = isFreeSearch
    ? `Você usou ${limit === 1 ? "a busca incluída" : `as ${limit} buscas incluídas`} no plano Grátis. Suas buscas anteriores e produtos salvos continuam disponíveis.`
    : isFreeKit
      ? `Você usou ${limit === 1 ? "o roteiro incluído" : `os ${limit} roteiros incluídos`} no plano Grátis. Tudo o que você criou continua salvo e acessível.`
      : message;

  const nextStep = isFreeSearch
    ? "Para descobrir novos produtos, conheça o Pro."
    : isFreeKit
      ? "Para criar sem contar roteiros, conheça o Pro."
      : null;

  return (
    <Modal titleId="upgrade-plan-title" onClose={onClose} className="upgrade-plan-dialog">
      <div className="upgrade-plan-content">
        <button className="upgrade-plan-close" type="button" aria-label="Fechar aviso" onClick={onClose}>
          <Icon name="x" size={18} />
        </button>
        <p className="upgrade-plan-label">{isFreeSearch || isFreeKit ? "Plano Grátis" : "Limite do plano"}</p>
        <h2 id="upgrade-plan-title">{title}</h2>
        <p className="upgrade-plan-description">{description}</p>
        {nextStep && <p className="upgrade-plan-next">{nextStep}</p>}
        <div className="upgrade-dialog-actions">
          {isFreeSearch || isFreeKit ? (
            <>
              <Link className="upgrade-plan-primary" href="/conta/planos" onClick={onClose}>
                Conhecer o Pro <Icon name="arrow-right" size={18} />
              </Link>
              <button className="upgrade-plan-secondary" type="button" onClick={onClose}>
                {isFreeKit ? "Ver meus roteiros" : "Voltar para Descobrir"}
              </button>
            </>
          ) : (
            <button className="upgrade-plan-primary" type="button" onClick={onClose}>Entendi</button>
          )}
        </div>
      </div>
    </Modal>
  );
}
