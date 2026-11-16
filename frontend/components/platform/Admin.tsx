"use client";

import { useCallback, useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";
import { usePlatform } from "./store";
import styles from "./Admin.module.css";
import { adminGet, adminToken } from "./admin/api";
import { formatCount, metricNumber } from "./admin/format";
import type { AdminDashboardMetrics, AdminView } from "./admin/types";
import { ADMIN_VIEWS } from "./admin/types";
import OverviewTab from "./admin/OverviewTab";
import ProductsTab from "./admin/ProductsTab";
import CreatorsTab from "./admin/CreatorsTab";
import LeadsTab from "./admin/LeadsTab";
import BillingTab from "./admin/BillingTab";
import SupportTab from "./admin/SupportTab";
import AiTab from "./admin/AiTab";

function viewFromHash(): AdminView {
  if (typeof window === "undefined") return "overview";
  const key = window.location.hash.replace(/^#/, "");
  return ADMIN_VIEWS.some((item) => item.key === key) ? (key as AdminView) : "overview";
}

function tabBadge(view: AdminView, metrics: AdminDashboardMetrics | null): number | null {
  if (!metrics) return null;
  if (view === "creators") return metricNumber(metrics, "total_creators");
  if (view === "billing") return metricNumber(metrics, "assinaturas_ativas");
  if (view === "support") return metricNumber(metrics, "suporte_abertos");
  if (view === "leads") return metricNumber(metrics, "leads_novos");
  if (view === "products") return metricNumber(metrics, "total_produtos");
  return null;
}

export default function Admin() {
  const { toast } = usePlatform();
  const [view, setView] = useState<AdminView>(() => viewFromHash());
  const [token, setToken] = useState<string | undefined>(undefined);
  const [metrics, setMetrics] = useState<AdminDashboardMetrics | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [createProduct, setCreateProduct] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Hash mantém a aba ao recarregar e permite mandar um link direto (/admin#leads).
  useEffect(() => {
    const onHashChange = () => setView(viewFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    let active = true;
    void adminToken().then((value) => {
      if (active) {
        setToken(value);
        setLastUpdated(new Date());
      }
    });
    return () => { active = false; };
  }, []);

  const loadMetrics = useCallback(async (accessToken?: string) => {
    try {
      const authToken = accessToken ?? token ?? (await adminToken());
      setMetrics(await adminGet<AdminDashboardMetrics>("/admin/dashboard", authToken));
      setLastUpdated(new Date());
    } catch {
      // Indicadores do cabeçalho são acessórios: as abas mostram o próprio erro.
    }
  }, [token]);

  useEffect(() => {
    const task = window.setTimeout(() => void loadMetrics(), 0);
    return () => window.clearTimeout(task);
  }, [loadMetrics]);

  function openView(next: AdminView) {
    setView(next);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", next === "overview" ? "/admin" : `/admin#${next}`);
    }
  }

  async function refreshAll() {
    if (refreshing) return;
    setRefreshing(true);
    await loadMetrics();
    setRefreshSignal((value) => value + 1);
    setRefreshing(false);
    toast("Painel atualizado.");
  }

  return (
    <section id="admin-view" className={styles.adminShell}>
      <header className={styles.hero}>
        <div>
          <p className="eyebrow">Painel administrativo</p>
          <h1>Controle a <span className="tt-hl">operação.</span></h1>
          <p className={styles.heroCopy}>
            Catálogo, creators, leads e saúde da plataforma em uma única visão.
          </p>
        </div>
        <div className={styles.heroActions}>
          <button className={styles.secondaryButton} type="button" onClick={() => void refreshAll()} disabled={refreshing}>
            <Icon name="refresh" size={16} /> {refreshing ? "Atualizando…" : "Atualizar dados"}
          </button>
          <button
            className={styles.primaryButton}
            type="button"
            onClick={() => {
              openView("products");
              setCreateProduct((value) => value + 1);
            }}
          >
            <Icon name="plus" size={16} /> Novo produto
          </button>
          <small>
            {lastUpdated
              ? `Atualizado às ${lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
              : "Carregando dados da operação"}
          </small>
        </div>
      </header>

      <nav className={styles.viewTabs} aria-label="Seções do painel">
        {ADMIN_VIEWS.map((item) => {
          const badge = tabBadge(item.key, metrics);
          return (
            <button
              key={item.key}
              type="button"
              className={view === item.key ? styles.activeTab : ""}
              onClick={() => openView(item.key)}
              aria-current={view === item.key ? "page" : undefined}
            >
              <Icon name={item.icon} size={16} /> {item.label}
              {badge != null && badge > 0 ? <span>{formatCount(badge, badge > 999)}</span> : null}
            </button>
          );
        })}
      </nav>

      {view === "overview" && (
        <OverviewTab key={`overview-${refreshSignal}`} token={token} onOpen={openView} />
      )}
      {view === "products" && (
        <ProductsTab
          key={`products-${refreshSignal}`}
          token={token}
          createSignal={createProduct}
          onChanged={() => void loadMetrics()}
        />
      )}
      {view === "creators" && (
        <CreatorsTab key={`creators-${refreshSignal}`} token={token} onChanged={() => void loadMetrics()} />
      )}
      {view === "leads" && (
        <LeadsTab key={`leads-${refreshSignal}`} token={token} onChanged={() => void loadMetrics()} />
      )}
      {view === "billing" && <BillingTab key={`billing-${refreshSignal}`} token={token} />}
      {view === "support" && <SupportTab key={`support-${refreshSignal}`} token={token} />}
      {view === "ai" && <AiTab key={`ai-${refreshSignal}`} token={token} />}
    </section>
  );
}
