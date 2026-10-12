/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { api, friendlyError } from "@/lib/api";
import { FALLBACK_IMAGE } from "@/lib/format";
import { usePlatform } from "./store";
import styles from "./Admin.module.css";

interface AdminProduct {
  id: string;
  produto_externo_id?: string | null;
  nome: string;
  categoria?: string | null;
  imagem_url?: string | null;
  preco_texto?: string | null;
  preco_min_brl?: number | null;
  preco_max_brl?: number | null;
  loja_nome?: string | null;
  comissao_percentual?: number | null;
  unidades_vendidas_periodo?: number | null;
  crescimento_vendas_percentual?: number | null;
  unidades_vendidas_total?: number | null;
  receita_periodo_brl?: number | null;
  receita_total_brl?: number | null;
  tiktok_shop_url?: string | null;
  ranking_origem?: number | null;
  fonte_dados?: string | null;
  status: "ativo" | "pausado";
  destaque?: boolean | null;
  ordem_destaque?: number | null;
  [key: string]: unknown;
}

interface AdminCreator {
  id: string;
  user_id: string;
  nome?: string | null;
  email?: string | null;
  nicho?: string[];
  status: "ativo" | "bloqueado";
  criado_em?: string | null;
}

interface ProductFormState {
  externalId: string;
  name: string;
  category: string;
  store: string;
  priceText: string;
  commission: string;
  priceMin: string;
  priceMax: string;
  region: string;
  sourceStatus: string;
  salesPeriod: string;
  salesGrowth: string;
  salesTotal: string;
  revenuePeriod: string;
  revenueTotal: string;
  storeSalesTotal: string;
  uploadDate: string;
  ranking: string;
  description: string;
  image: string;
  tiktokUrl: string;
  fastmossUrl: string;
  storeFastmossUrl: string;
  source: string;
  status: "ativo" | "pausado";
  featured: boolean;
  featuredOrder: string;
}

type AdminView = "overview" | "products" | "creators";
type ProductSort = "ranking" | "sales" | "revenue" | "name";

const PAGE_SIZE = 12;
const EMPTY_FORM: ProductFormState = {
  externalId: "", name: "", category: "", store: "", priceText: "", commission: "",
  priceMin: "", priceMax: "", region: "BR", sourceStatus: "Disponível", salesPeriod: "",
  salesGrowth: "", salesTotal: "", revenuePeriod: "", revenueTotal: "", storeSalesTotal: "",
  uploadDate: "", ranking: "", description: "", image: "", tiktokUrl: "", fastmossUrl: "",
  storeFastmossUrl: "", source: "Cadastro administrativo", status: "ativo", featured: false,
  featuredOrder: "0",
};

const METRIC_LABELS: Record<string, { label: string; detail: string }> = {
  total_creators: { label: "Creators", detail: "Contas cadastradas" },
  creators_ativos: { label: "Creators ativos", detail: "Com acesso à plataforma" },
  total_produtos: { label: "Produtos", detail: "Itens no catálogo" },
  produtos_ativos: { label: "Produtos ativos", detail: "Visíveis para creators" },
  total_content_kits: { label: "Conteúdos", detail: "Conteúdos disponíveis" },
  oportunidades_salvas: { label: "Oportunidades salvas", detail: "Produtos em consideração" },
  conteudos_publicados: { label: "Publicações", detail: "Conteúdos concluídos" },
};

const numberFormatter = new Intl.NumberFormat("pt-BR");
const compactFormatter = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });

function asNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function optional(value: string): string | undefined {
  const clean = value.trim();
  return clean || undefined;
}

function stringValue(value: unknown): string { return value == null ? "" : String(value); }
function inputDate(value: unknown): string { return value ? String(value).slice(0, 16) : ""; }

function formatCount(value: unknown, compact = false): string {
  const parsed = Number(value ?? 0);
  return (compact ? compactFormatter : numberFormatter).format(Number.isFinite(parsed) ? parsed : 0);
}

function formatCurrency(value: unknown): string {
  const parsed = Number(value ?? 0);
  return currencyFormatter.format(Number.isFinite(parsed) ? parsed : 0);
}

function formatPercent(value: unknown): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "—";
  return `${parsed > 0 ? "+" : ""}${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(parsed)}%`;
}

function metricNumber(metrics: Record<string, number | string> | null, key: string, fallback: number): number {
  const value = Number(metrics?.[key]);
  return Number.isFinite(value) ? value : fallback;
}

function initials(creator: AdminCreator): string {
  return (creator.nome || creator.email || "Creator").split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function AdminIcon({ name }: { name: "overview" | "box" | "users" | "refresh" | "plus" | "search" | "download" | "edit" | "external" }) {
  const paths = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
    box: <><path d="m21 8-9 5-9-5 9-5 9 5Z"/><path d="m3 8 9 5 9-5v8l-9 5-9-5V8Z"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    refresh: <><path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    download: <><path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/></>,
    edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></>,
    external: <><path d="M14 3h7v7M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export default function Admin() {
  const { toast } = usePlatform();
  const formRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<AdminView>("overview");
  const [metrics, setMetrics] = useState<Record<string, number | string> | null>(null);
  const [metricsError, setMetricsError] = useState(false);
  const [products, setProducts] = useState<AdminProduct[] | null>(null);
  const [productsError, setProductsError] = useState(false);
  const [creators, setCreators] = useState<AdminCreator[] | null>(null);
  const [creatorsError, setCreatorsError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductFormState>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [productQuery, setProductQuery] = useState("");
  const [productStatus, setProductStatus] = useState("todos");
  const [productCategory, setProductCategory] = useState("todas");
  const [productSort, setProductSort] = useState<ProductSort>("ranking");
  const [productPage, setProductPage] = useState(1);
  const [creatorQuery, setCreatorQuery] = useState("");
  const [creatorStatus, setCreatorStatus] = useState("todos");

  const token = useCallback(async () => {
    const { data } = await supabase().auth.getSession();
    return data.session?.access_token;
  }, []);

  const loadDashboard = useCallback(async (accessToken?: string) => {
    try {
      setMetricsError(false);
      setMetrics(await api<Record<string, number | string>>("/admin/dashboard", accessToken ?? await token()));
    } catch { setMetricsError(true); }
  }, [token]);

  const loadProducts = useCallback(async (accessToken?: string) => {
    try {
      setProductsError(false);
      const authToken = accessToken ?? await token();
      const all: AdminProduct[] = [];
      for (let page = 1; page <= 100; page += 1) {
        const batch = await api<AdminProduct[]>(`/admin/products?page=${page}&limit=100`, authToken);
        all.push(...batch);
        if (batch.length < 100) break;
      }
      setProducts(all);
    } catch { setProductsError(true); }
  }, [token]);

  const loadCreators = useCallback(async (accessToken?: string) => {
    try {
      setCreatorsError(false);
      const authToken = accessToken ?? await token();
      const all: AdminCreator[] = [];
      for (let page = 1; page <= 100; page += 1) {
        const batch = await api<AdminCreator[]>(`/admin/creators?page=${page}&limit=100`, authToken);
        all.push(...batch);
        if (batch.length < 100) break;
      }
      setCreators(all);
    } catch { setCreatorsError(true); }
  }, [token]);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    const accessToken = await token();
    await Promise.all([loadDashboard(accessToken), loadProducts(accessToken), loadCreators(accessToken)]);
    setLastUpdated(new Date());
    setRefreshing(false);
  }, [loadCreators, loadDashboard, loadProducts, token]);

  useEffect(() => {
    const task = window.setTimeout(() => void refreshAll(), 0);
    return () => window.clearTimeout(task);
  }, [refreshAll]);

  const categories = useMemo(() => [...new Set((products ?? []).map((product) => product.categoria).filter((category): category is string => Boolean(category)))].sort((a, b) => a.localeCompare(b, "pt-BR")), [products]);

  const filteredProducts = useMemo(() => {
    const query = productQuery.trim().toLocaleLowerCase("pt-BR");
    return [...(products ?? [])]
      .filter((product) => productStatus === "todos" || product.status === productStatus)
      .filter((product) => productCategory === "todas" || product.categoria === productCategory)
      .filter((product) => !query || [product.nome, product.loja_nome, product.categoria, product.produto_externo_id].some((value) => String(value ?? "").toLocaleLowerCase("pt-BR").includes(query)))
      .sort((a, b) => {
        if (productSort === "name") return a.nome.localeCompare(b.nome, "pt-BR");
        if (productSort === "sales") return Number(b.unidades_vendidas_periodo ?? 0) - Number(a.unidades_vendidas_periodo ?? 0);
        if (productSort === "revenue") return Number(b.receita_periodo_brl ?? 0) - Number(a.receita_periodo_brl ?? 0);
        return Number(a.ranking_origem ?? Number.MAX_SAFE_INTEGER) - Number(b.ranking_origem ?? Number.MAX_SAFE_INTEGER);
      });
  }, [productCategory, productQuery, productSort, productStatus, products]);

  const productPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const visibleProducts = filteredProducts.slice((productPage - 1) * PAGE_SIZE, productPage * PAGE_SIZE);

  const filteredCreators = useMemo(() => {
    const query = creatorQuery.trim().toLocaleLowerCase("pt-BR");
    return (creators ?? []).filter((creator) => {
      const statusMatch = creatorStatus === "todos" || creator.status === creatorStatus;
      const queryMatch = !query || [creator.nome, creator.email, creator.user_id, ...(creator.nicho ?? [])].some((value) => String(value ?? "").toLocaleLowerCase("pt-BR").includes(query));
      return statusMatch && queryMatch;
    });
  }, [creatorQuery, creatorStatus, creators]);

  const activeProducts = (products ?? []).filter((product) => product.status === "ativo").length;
  const pausedProducts = (products ?? []).filter((product) => product.status === "pausado").length;
  const activeCreators = (creators ?? []).filter((creator) => creator.status === "ativo").length;
  const blockedCreators = (creators ?? []).filter((creator) => creator.status === "bloqueado").length;
  const incompleteProducts = (products ?? []).filter((product) => !product.imagem_url || !product.produto_externo_id).length;

  function patchForm<K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openNewProduct() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setFormOpen(true);
    setView("products");
    window.requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
  }

  async function toggleProductStatus(product: AdminProduct) {
    setBusyId(product.id);
    try {
      await api(`/admin/products/${product.id}`, await token(), { method: "PATCH", body: JSON.stringify({ status: product.status === "ativo" ? "pausado" : "ativo" }) });
      toast(product.status === "ativo" ? "Produto pausado." : "Produto ativado.");
      await Promise.all([loadDashboard(), loadProducts()]);
    } catch (error) { toast(friendlyError(error, "Não conseguimos atualizar o produto.")); }
    finally { setBusyId(null); }
  }

  async function toggleCreator(creator: AdminCreator) {
    if (creator.status === "ativo" && !window.confirm(`Bloquear ${creator.nome || creator.email || "este creator"}? O acesso à plataforma será interrompido.`)) return;
    setBusyId(creator.id);
    try {
      await api(`/admin/creators/${creator.id}/status`, await token(), { method: "PATCH", body: JSON.stringify({ status: creator.status === "ativo" ? "bloqueado" : "ativo" }) });
      toast(creator.status === "ativo" ? "Creator bloqueado." : "Creator reativado.");
      await Promise.all([loadDashboard(), loadCreators()]);
    } catch (error) { toast(friendlyError(error, "Não conseguimos atualizar o creator.")); }
    finally { setBusyId(null); }
  }

  async function editProduct(id: string) {
    setBusyId(id);
    try {
      const data = await api<{ product: Record<string, unknown> }>(`/admin/products/${id}`, await token());
      const product = data.product;
      setForm({
        externalId: stringValue(product.produto_externo_id), name: stringValue(product.nome), category: stringValue(product.categoria),
        store: stringValue(product.loja_nome), priceText: stringValue(product.preco_texto), commission: stringValue(product.comissao_percentual),
        priceMin: stringValue(product.preco_min_brl), priceMax: stringValue(product.preco_max_brl), region: stringValue(product.pais_regiao) || "BR",
        sourceStatus: stringValue(product.status_origem) || "Disponível", salesPeriod: stringValue(product.unidades_vendidas_periodo),
        salesGrowth: stringValue(product.crescimento_vendas_percentual), salesTotal: stringValue(product.unidades_vendidas_total),
        revenuePeriod: stringValue(product.receita_periodo_brl), revenueTotal: stringValue(product.receita_total_brl),
        storeSalesTotal: stringValue(product.unidades_vendidas_total_loja), uploadDate: inputDate(product.data_estimada_upload),
        ranking: stringValue(product.ranking_origem), description: stringValue(product.descricao), image: stringValue(product.imagem_url),
        tiktokUrl: stringValue(product.tiktok_shop_url), fastmossUrl: stringValue(product.fastmoss_produto_url), storeFastmossUrl: stringValue(product.fastmoss_loja_url),
        source: stringValue(product.fonte_dados) || "Cadastro administrativo", status: product.status === "pausado" ? "pausado" : "ativo",
        featured: Boolean(product.destaque), featuredOrder: stringValue(product.ordem_destaque) || "0",
      });
      setEditingId(id);
      setFormOpen(true);
      window.requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (error) { toast(friendlyError(error, "Não conseguimos abrir o produto.")); }
    finally { setBusyId(null); }
  }

  async function uploadImage(file: File) {
    if (file.size > 5 * 1024 * 1024) { toast("A imagem deve ter no máximo 5 MB."); return; }
    setUploading(true);
    try {
      const { requireApiUrl } = await import("@/lib/config");
      const body = new FormData();
      body.append("file", file);
      const accessToken = await token();
      const response = await fetch(`${requireApiUrl()}/admin/products/image`, { method: "POST", headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}, body });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error?.message || `Erro ${response.status}`);
      patchForm("image", result.imagem_url);
      toast("Imagem enviada.");
    } catch (error) { toast(friendlyError(error, "Não conseguimos enviar a imagem.")); }
    finally { setUploading(false); }
  }

  async function submitProduct(event: React.FormEvent) {
    event.preventDefault();
    const min = asNumber(form.priceMin);
    const max = asNumber(form.priceMax);
    if (min != null && max != null && min > max) { toast("O preço mínimo não pode ser maior que o máximo."); return; }
    const input = {
      produto_externo_id: optional(form.externalId), nome: form.name.trim(), descricao: optional(form.description), categoria: optional(form.category),
      imagem_url: form.image.trim(), loja_nome: optional(form.store), preco_texto: optional(form.priceText), preco_min_brl: min, preco_max_brl: max,
      pais_regiao: optional(form.region), comissao_percentual: asNumber(form.commission), unidades_vendidas_periodo: asNumber(form.salesPeriod),
      crescimento_vendas_percentual: asNumber(form.salesGrowth), unidades_vendidas_total: asNumber(form.salesTotal), receita_periodo_brl: asNumber(form.revenuePeriod),
      receita_total_brl: asNumber(form.revenueTotal), data_estimada_upload: optional(form.uploadDate), unidades_vendidas_total_loja: asNumber(form.storeSalesTotal),
      fastmoss_produto_url: optional(form.fastmossUrl), tiktok_shop_url: optional(form.tiktokUrl), fastmoss_loja_url: optional(form.storeFastmossUrl),
      status_origem: optional(form.sourceStatus), fonte_dados: optional(form.source), ranking_origem: asNumber(form.ranking), status: form.status,
      destaque: form.featured, ordem_destaque: asNumber(form.featuredOrder) ?? 0,
    };
    setSaving(true);
    try {
      if (editingId) {
        await api(`/admin/products/${editingId}`, await token(), { method: "PATCH", body: JSON.stringify(input) });
        toast("Produto atualizado.");
      } else {
        await api("/admin/products", await token(), { method: "POST", body: JSON.stringify(input) });
        toast("Produto adicionado ao catálogo.");
      }
      closeForm();
      await Promise.all([loadDashboard(), loadProducts()]);
    } catch (error) { toast(friendlyError(error, "Não conseguimos salvar o produto. Revise os campos e tente novamente.")); }
    finally { setSaving(false); }
  }

  function exportCatalog() {
    if (!products?.length) return;
    const headings = ["ID", "Produto", "Categoria", "Loja", "Preço", "Comissão", "Vendas no período", "Crescimento", "Receita no período", "Status"];
    const rows = products.map((product) => [product.produto_externo_id, product.nome, product.categoria, product.loja_nome, product.preco_texto, product.comissao_percentual, product.unidades_vendidas_periodo, product.crescimento_vendas_percentual, product.receita_periodo_brl, product.status]);
    const csv = [headings, ...rows].map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(";")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    link.download = `catalogo-temtrend-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const metricEntries = Object.entries(METRIC_LABELS).map(([key, copy]) => ({
    key, ...copy,
    value: metricNumber(metrics, key, key === "total_creators" ? (creators ?? []).length : key === "creators_ativos" ? activeCreators : key === "total_produtos" ? (products ?? []).length : key === "produtos_ativos" ? activeProducts : 0),
  }));

  return (
    <section id="admin-view" className={styles.adminShell}>
      <header className={styles.hero}>
        <div>
          <p className="eyebrow">Painel administrativo</p>
          <h1>Controle a operação <em>sem perder o ritmo.</em></h1>
          <p className={styles.heroCopy}>Catálogo, creators e saúde da plataforma em uma única visão.</p>
        </div>
        <div className={styles.heroActions}>
          <button className={styles.secondaryButton} type="button" onClick={() => void refreshAll()} disabled={refreshing}><AdminIcon name="refresh" /> {refreshing ? "Atualizando…" : "Atualizar dados"}</button>
          <button className={styles.primaryButton} type="button" onClick={openNewProduct}><AdminIcon name="plus" /> Novo produto</button>
          <small>{lastUpdated ? `Atualizado às ${lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "Carregando dados da operação"}</small>
        </div>
      </header>

      <nav className={styles.viewTabs} aria-label="Seções do painel">
        {([["overview", "overview", "Visão geral"], ["products", "box", "Produtos"], ["creators", "users", "Creators"]] as const).map(([key, icon, label]) => (
          <button key={key} type="button" className={view === key ? styles.activeTab : ""} onClick={() => setView(key)} aria-current={view === key ? "page" : undefined}>
            <AdminIcon name={icon} /> {label}
            {key === "products" && products && <span>{products.length}</span>}
            {key === "creators" && creators && <span>{creators.length}</span>}
          </button>
        ))}
      </nav>

      {view === "overview" && (
        <div className={styles.viewPanel}>
          <div className={styles.sectionHeading}><div><span>Agora</span><h2>Resumo da plataforma</h2></div><p>Indicadores essenciais para priorizar as próximas ações.</p></div>
          {metricsError && !metrics ? (
            <div className={styles.errorState}><strong>Não foi possível carregar as métricas.</strong><button type="button" onClick={() => void loadDashboard()}>Tentar novamente</button></div>
          ) : (
            <div className={styles.metricGrid} aria-live="polite">
              {metrics ? metricEntries.map((metric, index) => (
                <article key={metric.key} className={styles.metricCard}><span className={styles.metricIndex}>{String(index + 1).padStart(2, "0")}</span><strong>{formatCount(metric.value)}</strong><h3>{metric.label}</h3><p>{metric.detail}</p></article>
              )) : Array.from({ length: 7 }).map((_, index) => <div className={styles.metricSkeleton} key={index} aria-hidden="true" />)}
            </div>
          )}
          <div className={styles.overviewGrid}>
            <article className={styles.healthCard}>
              <div className={styles.cardHeading}><div><span>Saúde do catálogo</span><h2>Pronto para descoberta</h2></div><button type="button" onClick={() => setView("products")}>Ver catálogo</button></div>
              <div className={styles.progressBlock}><div><strong>{products?.length ? Math.round((activeProducts / products.length) * 100) : 0}%</strong><span>dos produtos estão ativos</span></div><div className={styles.progressTrack}><i style={{ width: `${products?.length ? (activeProducts / products.length) * 100 : 0}%` }} /></div></div>
              <dl className={styles.healthList}><div><dt>Ativos</dt><dd>{activeProducts}</dd></div><div><dt>Pausados</dt><dd>{pausedProducts}</dd></div><div><dt>Cadastro incompleto</dt><dd className={incompleteProducts ? styles.attention : ""}>{incompleteProducts}</dd></div></dl>
            </article>
            <article className={styles.healthCard}>
              <div className={styles.cardHeading}><div><span>Comunidade</span><h2>Creators com acesso</h2></div><button type="button" onClick={() => setView("creators")}>Gerenciar</button></div>
              <div className={styles.progressBlock}><div><strong>{creators?.length ? Math.round((activeCreators / creators.length) * 100) : 0}%</strong><span>das contas estão ativas</span></div><div className={styles.progressTrack}><i style={{ width: `${creators?.length ? (activeCreators / creators.length) * 100 : 0}%` }} /></div></div>
              <dl className={styles.healthList}><div><dt>Ativos</dt><dd>{activeCreators}</dd></div><div><dt>Bloqueados</dt><dd className={blockedCreators ? styles.attention : ""}>{blockedCreators}</dd></div><div><dt>Publicações</dt><dd>{formatCount(metrics?.conteudos_publicados)}</dd></div></dl>
            </article>
            <article className={`${styles.healthCard} ${styles.aiCard}`}>
              <div className={styles.cardHeading}><div><span>Uso de IA</span><h2>Consumo operacional</h2></div><i>Gemini</i></div>
              <dl className={styles.aiMetrics}><div><dt>Classificações</dt><dd>{formatCount(metrics?.ai_classify_calls)}</dd></div><div><dt>Gerações</dt><dd>{formatCount(metrics?.ai_generate_calls)}</dd></div><div><dt>Tokens de classificação</dt><dd>{formatCount(metrics?.ai_classify_tokens, true)}</dd></div><div><dt>Tokens de geração</dt><dd>{formatCount(metrics?.ai_generate_tokens, true)}</dd></div></dl>
            </article>
          </div>
        </div>
      )}

      {view === "products" && (
        <div className={styles.viewPanel}>
          <div className={styles.sectionHeading}><div><span>Catálogo</span><h2>Produtos da plataforma</h2></div><p>Encontre, revise e publique oportunidades para creators.</p></div>
          {formOpen && (
            <div className={styles.editor} ref={formRef}>
              <div className={styles.editorHeading}><div><span>{editingId ? "Editando produto" : "Novo produto"}</span><h2>{editingId ? form.name || "Produto" : "Adicionar ao catálogo"}</h2><p>Organize os dados que alimentam a descoberta e os roteiros de conteúdo.</p></div><button type="button" onClick={closeForm} aria-label="Fechar formulário">×</button></div>
              <form onSubmit={submitProduct} className={styles.productForm}>
                <fieldset>
                  <legend><b>1</b><span>Identificação<small>Informações que o creator verá primeiro.</small></span></legend>
                  <div className={styles.formGrid}>
                    <label className={styles.wide}>Nome do produto<input value={form.name} onChange={(event) => patchForm("name", event.target.value)} required maxLength={500} /></label>
                    <label>ID externo<input value={form.externalId} onChange={(event) => patchForm("externalId", event.target.value)} maxLength={80} placeholder="ID do TikTok Shop" /></label>
                    <label>Categoria<input value={form.category} onChange={(event) => patchForm("category", event.target.value)} list="admin-categories" maxLength={200} /><datalist id="admin-categories">{categories.map((category) => <option key={category} value={category} />)}</datalist></label>
                    <label>Loja<input value={form.store} onChange={(event) => patchForm("store", event.target.value)} maxLength={200} /></label>
                    <label>País/Região<input value={form.region} onChange={(event) => patchForm("region", event.target.value)} maxLength={20} /></label>
                    <label className={styles.wide}>Descrição confirmada<textarea value={form.description} onChange={(event) => patchForm("description", event.target.value)} maxLength={4000} rows={4} placeholder="Use apenas informações verificadas sobre o produto." /></label>
                  </div>
                </fieldset>
                <fieldset>
                  <legend><b>2</b><span>Preço e performance<small>Dados usados para ordenar e contextualizar oportunidades.</small></span></legend>
                  <div className={styles.formGrid}>
                    <label>Preço exibido<input value={form.priceText} onChange={(event) => patchForm("priceText", event.target.value)} placeholder="R$ 39,90 – 49,90" /></label>
                    <label>Comissão (%)<input value={form.commission} onChange={(event) => patchForm("commission", event.target.value)} type="number" min={0} max={100} step="0.01" /></label>
                    <label>Preço mínimo (R$)<input value={form.priceMin} onChange={(event) => patchForm("priceMin", event.target.value)} type="number" min={0} step="0.01" /></label>
                    <label>Preço máximo (R$)<input value={form.priceMax} onChange={(event) => patchForm("priceMax", event.target.value)} type="number" min={0} step="0.01" /></label>
                    <label>Vendas no período<input value={form.salesPeriod} onChange={(event) => patchForm("salesPeriod", event.target.value)} type="number" min={0} step={1} /></label>
                    <label>Crescimento (%)<input value={form.salesGrowth} onChange={(event) => patchForm("salesGrowth", event.target.value)} type="number" step="0.01" /></label>
                    <label>Total vendido<input value={form.salesTotal} onChange={(event) => patchForm("salesTotal", event.target.value)} type="number" min={0} step={1} /></label>
                    <label>Vendas da loja<input value={form.storeSalesTotal} onChange={(event) => patchForm("storeSalesTotal", event.target.value)} type="number" min={0} step={1} /></label>
                    <label>Receita no período (R$)<input value={form.revenuePeriod} onChange={(event) => patchForm("revenuePeriod", event.target.value)} type="number" min={0} step="0.01" /></label>
                    <label>Receita total (R$)<input value={form.revenueTotal} onChange={(event) => patchForm("revenueTotal", event.target.value)} type="number" min={0} step="0.01" /></label>
                    <label>Ranking<input value={form.ranking} onChange={(event) => patchForm("ranking", event.target.value)} type="number" min={1} step={1} /></label>
                    <label>Data estimada de upload<input value={form.uploadDate} onChange={(event) => patchForm("uploadDate", event.target.value)} type="datetime-local" /></label>
                  </div>
                </fieldset>
                <fieldset>
                  <legend><b>3</b><span>Mídia e links<small>Revise a imagem antes de publicar.</small></span></legend>
                  <div className={styles.mediaEditor}>
                    <div className={styles.imagePreview}><img src={form.image || FALLBACK_IMAGE} alt="Prévia do produto" onError={(event) => { event.currentTarget.src = FALLBACK_IMAGE; }} /><span>{form.image ? "Prévia atual" : "Sem imagem"}</span></div>
                    <div className={styles.mediaFields}>
                      <label>URL da imagem<input value={form.image} onChange={(event) => patchForm("image", event.target.value)} type="url" required placeholder="https://..." /></label>
                      <label className={styles.fileField}>Enviar nova imagem<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadImage(file); }} /><span>{uploading ? "Enviando…" : "JPG, PNG, WebP ou GIF · até 5 MB"}</span></label>
                      <label>Link no TikTok Shop<input value={form.tiktokUrl} onChange={(event) => patchForm("tiktokUrl", event.target.value)} type="url" placeholder="https://shop.tiktok.com/..." /></label>
                      <label>Link do produto no FastMoss<input value={form.fastmossUrl} onChange={(event) => patchForm("fastmossUrl", event.target.value)} type="url" placeholder="https://www.fastmoss.com/..." /></label>
                      <label>Link da loja no FastMoss<input value={form.storeFastmossUrl} onChange={(event) => patchForm("storeFastmossUrl", event.target.value)} type="url" placeholder="https://www.fastmoss.com/..." /></label>
                    </div>
                  </div>
                </fieldset>
                <fieldset>
                  <legend><b>4</b><span>Publicação<small>Controle onde e como o produto aparece.</small></span></legend>
                  <div className={styles.formGrid}>
                    <label>Fonte dos dados<input value={form.source} onChange={(event) => patchForm("source", event.target.value)} maxLength={255} /></label>
                    <label>Status na fonte<input value={form.sourceStatus} onChange={(event) => patchForm("sourceStatus", event.target.value)} maxLength={50} /></label>
                    <label>Status no catálogo<select value={form.status} onChange={(event) => patchForm("status", event.target.value as ProductFormState["status"])}><option value="ativo">Ativo</option><option value="pausado">Pausado</option></select></label>
                    <label>Ordem de destaque<input value={form.featuredOrder} onChange={(event) => patchForm("featuredOrder", event.target.value)} type="number" min={0} step={1} disabled={!form.featured} /></label>
                    <label className={`${styles.wide} ${styles.checkField}`}><input checked={form.featured} onChange={(event) => patchForm("featured", event.target.checked)} type="checkbox" /><span><strong>Destacar produto</strong><small>Prioriza esta oportunidade nas áreas de descoberta.</small></span></label>
                  </div>
                </fieldset>
                <div className={styles.formActions}><button className={styles.secondaryButton} type="button" onClick={closeForm}>Cancelar</button><button className={styles.primaryButton} type="submit" disabled={saving || uploading}>{saving ? "Salvando…" : editingId ? "Salvar alterações" : "Adicionar produto"}</button></div>
              </form>
            </div>
          )}

          <div className={styles.toolbar}>
            <label className={styles.searchField}><AdminIcon name="search" /><input aria-label="Buscar produtos" value={productQuery} onChange={(event) => { setProductQuery(event.target.value); setProductPage(1); }} placeholder="Buscar produto, loja, categoria ou ID" /></label>
            <select aria-label="Filtrar por status" value={productStatus} onChange={(event) => { setProductStatus(event.target.value); setProductPage(1); }}><option value="todos">Todos os status</option><option value="ativo">Ativos</option><option value="pausado">Pausados</option></select>
            <select aria-label="Filtrar por categoria" value={productCategory} onChange={(event) => { setProductCategory(event.target.value); setProductPage(1); }}><option value="todas">Todas as categorias</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select>
            <select aria-label="Ordenar produtos" value={productSort} onChange={(event) => { setProductSort(event.target.value as ProductSort); setProductPage(1); }}><option value="ranking">Melhor ranking</option><option value="sales">Mais vendidos</option><option value="revenue">Maior receita</option><option value="name">Nome A–Z</option></select>
            <button className={styles.iconButton} type="button" onClick={exportCatalog} disabled={!products?.length} title="Exportar catálogo"><AdminIcon name="download" /><span>Exportar</span></button>
          </div>
          <div className={styles.listMeta}><p><strong>{filteredProducts.length}</strong> {filteredProducts.length === 1 ? "produto encontrado" : "produtos encontrados"}</p><button type="button" onClick={openNewProduct}><AdminIcon name="plus" /> Adicionar produto</button></div>
          {productsError && products === null ? (
            <div className={styles.errorState}><strong>Não foi possível carregar os produtos.</strong><button type="button" onClick={() => void loadProducts()}>Tentar novamente</button></div>
          ) : products === null ? (
            <div className={styles.listSkeleton}>{Array.from({ length: 6 }).map((_, index) => <i key={index} />)}</div>
          ) : visibleProducts.length ? (
            <div className={styles.productList}>
              {visibleProducts.map((product) => (
                <article key={product.id} className={styles.productRow}>
                  <img src={product.imagem_url || FALLBACK_IMAGE} alt="" onError={(event) => { event.currentTarget.src = FALLBACK_IMAGE; }} />
                  <div className={styles.productIdentity}><div className={styles.badges}><span className={product.status === "ativo" ? styles.statusActive : styles.statusPaused}>{product.status === "ativo" ? "Ativo" : "Pausado"}</span>{product.destaque && <span className={styles.featuredBadge}>Destaque</span>}{product.ranking_origem && <span>#{product.ranking_origem}</span>}</div><h3>{product.nome}</h3><p>{[product.loja_nome, product.categoria, product.produto_externo_id ? `ID ${product.produto_externo_id}` : null].filter(Boolean).join(" · ")}</p></div>
                  <dl className={styles.productStats}><div><dt>Preço</dt><dd>{product.preco_texto || "—"}</dd></div><div><dt>Vendas</dt><dd>{formatCount(product.unidades_vendidas_periodo, true)}</dd></div><div><dt>Crescimento</dt><dd className={Number(product.crescimento_vendas_percentual) < 0 ? styles.negative : styles.positive}>{formatPercent(product.crescimento_vendas_percentual)}</dd></div><div><dt>Receita</dt><dd>{formatCurrency(product.receita_periodo_brl)}</dd></div></dl>
                  <div className={styles.rowActions}>{product.tiktok_shop_url && <a href={String(product.tiktok_shop_url)} target="_blank" rel="noreferrer" aria-label="Abrir produto no TikTok Shop"><AdminIcon name="external" /></a>}<button type="button" onClick={() => void editProduct(product.id)} disabled={busyId === product.id}><AdminIcon name="edit" /> Editar</button><button type="button" className={product.status === "ativo" ? styles.pauseAction : styles.activateAction} onClick={() => void toggleProductStatus(product)} disabled={busyId === product.id}>{busyId === product.id ? "Aguarde…" : product.status === "ativo" ? "Pausar" : "Ativar"}</button></div>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}><strong>Nenhum produto corresponde aos filtros.</strong><p>Ajuste a busca ou limpe os filtros para ver todo o catálogo.</p><button type="button" onClick={() => { setProductQuery(""); setProductStatus("todos"); setProductCategory("todas"); setProductPage(1); }}>Limpar filtros</button></div>
          )}
          {productPages > 1 && <div className={styles.pagination}><button type="button" disabled={productPage === 1} onClick={() => setProductPage((page) => Math.max(1, page - 1))}>Anterior</button><span>Página <strong>{productPage}</strong> de {productPages}</span><button type="button" disabled={productPage === productPages} onClick={() => setProductPage((page) => Math.min(productPages, page + 1))}>Próxima</button></div>}
        </div>
      )}

      {view === "creators" && (
        <div className={styles.viewPanel}>
          <div className={styles.sectionHeading}><div><span>Comunidade</span><h2>Creators cadastrados</h2></div><p>Encontre contas, entenda interesses e gerencie o acesso.</p></div>
          <div className={styles.creatorSummary}><div><span>Total</span><strong>{creators?.length ?? 0}</strong></div><div><span>Ativos</span><strong>{activeCreators}</strong></div><div><span>Bloqueados</span><strong>{blockedCreators}</strong></div><div><span>Taxa ativa</span><strong>{creators?.length ? `${Math.round((activeCreators / creators.length) * 100)}%` : "0%"}</strong></div></div>
          <div className={`${styles.toolbar} ${styles.creatorToolbar}`}><label className={styles.searchField}><AdminIcon name="search" /><input aria-label="Buscar creators" value={creatorQuery} onChange={(event) => setCreatorQuery(event.target.value)} placeholder="Buscar por nome, email, nicho ou ID" /></label><select aria-label="Filtrar creators por status" value={creatorStatus} onChange={(event) => setCreatorStatus(event.target.value)}><option value="todos">Todos os status</option><option value="ativo">Ativos</option><option value="bloqueado">Bloqueados</option></select></div>
          <div className={styles.listMeta}><p><strong>{filteredCreators.length}</strong> {filteredCreators.length === 1 ? "creator encontrado" : "creators encontrados"}</p></div>
          {creatorsError && creators === null ? (
            <div className={styles.errorState}><strong>Não foi possível carregar os creators.</strong><button type="button" onClick={() => void loadCreators()}>Tentar novamente</button></div>
          ) : creators === null ? (
            <div className={styles.listSkeleton}>{Array.from({ length: 5 }).map((_, index) => <i key={index} />)}</div>
          ) : filteredCreators.length ? (
            <div className={styles.creatorList}>{filteredCreators.map((creator) => (
              <article key={creator.id} className={styles.creatorRow}><div className={styles.avatar}>{initials(creator)}</div><div className={styles.creatorIdentity}><div><h3>{creator.nome || "Creator sem nome"}</h3><span className={creator.status === "ativo" ? styles.statusActive : styles.statusBlocked}>{creator.status === "ativo" ? "Ativo" : "Bloqueado"}</span></div><p>{creator.email || creator.user_id}</p></div><div className={styles.niches}>{creator.nicho?.length ? creator.nicho.map((niche) => <span key={niche}>{niche}</span>) : <span>Sem nicho informado</span>}</div><button type="button" className={creator.status === "ativo" ? styles.blockAction : styles.activateAction} onClick={() => void toggleCreator(creator)} disabled={busyId === creator.id}>{busyId === creator.id ? "Aguarde…" : creator.status === "ativo" ? "Bloquear acesso" : "Reativar acesso"}</button></article>
            ))}</div>
          ) : (
            <div className={styles.emptyState}><strong>Nenhum creator corresponde aos filtros.</strong><p>Tente outro nome, email ou status.</p><button type="button" onClick={() => { setCreatorQuery(""); setCreatorStatus("todos"); }}>Limpar filtros</button></div>
          )}
        </div>
      )}
    </section>
  );
}
