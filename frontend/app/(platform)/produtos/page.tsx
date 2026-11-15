"use client";

import Link from "next/link";
import Icon from "@/components/ui/Icon";
import { hasPaidPlan } from "@/lib/plan-access";
import { usePlatform } from "@/components/platform/store";
import ProductsView from "@/components/platform/ProductsView";

export default function ProdutosPage() {
  const { admin, me } = usePlatform();

  if (admin) {
    return (
      <div className="empty-state">
        <h3>Área de creators.</h3>
        <p>Sua conta é administradora.</p>
      </div>
    );
  }

  if (!hasPaidPlan(me?.creator)) {
    return (
      <section id="creator-products-view">
        <div className="prod-locked">
          <span className="prod-locked-icon" aria-hidden="true"><Icon name="plan" size={22} /></span>
          <p className="eyebrow">Catálogo completo</p>
          <h1>Os produtos ficam no <span className="tt-hl">Pro.</span></h1>
          <p>
            No plano Grátis você usa o Descobrir para criar seus primeiros conteúdos. Para navegar pelo
            catálogo, filtros e comissões, assine o Pro.
          </p>
          <div className="prod-locked-actions">
            <Link className="primary" href="/conta/planos">Conhecer o Pro</Link>
            <Link className="ghost" href="/descobrir">Ir para o Descobrir</Link>
          </div>
          <small>Seus produtos salvos e conteúdos continuam disponíveis.</small>
        </div>
      </section>
    );
  }

  return (
    <section id="creator-products-view">
      <ProductsView />
    </section>
  );
}
