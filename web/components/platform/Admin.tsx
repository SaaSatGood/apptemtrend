"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { api, friendlyError } from "@/lib/api";
import { usePlatform } from "./store";

interface AdminProduct {
  id: string;
  produto_externo_id?: string | null;
  nome: string;
  categoria?: string | null;
  preco_texto?: string | null;
  loja_nome?: string | null;
  status: string;
  [key: string]: unknown;
}

interface AdminCreator {
  id: string;
  user_id: string;
  nome?: string | null;
  email?: string | null;
  nicho?: string[];
  status: string;
}

const EMPTY_FORM: Record<string, string> = {
  "editing-product-id": "",
  "product-external-id": "",
  "product-name": "",
  "product-category": "",
  "product-store": "",
  "product-price-text": "",
  "product-commission": "",
  "product-price-min": "",
  "product-price-max": "",
  "product-region": "BR",
  "product-source-status": "Disponível",
  "product-sales-period": "",
  "product-sales-growth": "",
  "product-sales-total": "",
  "product-revenue-period": "",
  "product-revenue-total": "",
  "product-store-sales-total": "",
  "product-upload-date": "",
  "product-ranking": "",
  "product-description": "",
  "product-image": "",
  "product-tiktok-url": "",
  "product-fastmoss-url": "",
  "product-store-fastmoss-url": "",
  "product-source": "Cadastro administrativo",
  "product-status": "ativo",
};

function get(id: string): string {
  return (document.getElementById(id) as HTMLInputElement | null)?.value.trim() ?? "";
}
function set(id: string, value: unknown) {
  const el = document.getElementById(id) as HTMLInputElement | null;
  if (el) el.value = value == null ? "" : String(value);
}
function num(id: string): number | undefined {
  const v = get(id);
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
function opt(id: string): string | undefined {
  const v = get(id);
  return v || undefined;
}

export default function Admin() {
  const { toast } = usePlatform();
  const [metrics, setMetrics] = useState<Record<string, number | string> | null>(null);
  const [metricsError, setMetricsError] = useState(false);
  const [products, setProducts] = useState<AdminProduct[] | null>(null);
  const [productsError, setProductsError] = useState(false);
  const [creators, setCreators] = useState<AdminCreator[] | null>(null);
  const [creatorsError, setCreatorsError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const token = useCallback(async () => {
    const { data } = await supabase().auth.getSession();
    return data.session?.access_token;
  }, []);

  const loadDashboard = useCallback(async () => {
    try {
      setMetricsError(false);
      setMetrics(await api<Record<string, number>>("/admin/dashboard", await token()));
    } catch {
      setMetricsError(true);
    }
  }, [token]);

  const loadProducts = useCallback(async () => {
    try {
      setProductsError(false);
      setProducts(await api<AdminProduct[]>("/admin/products", await token()));
    } catch {
      setProductsError(true);
    }
  }, [token]);

  const loadCreators = useCallback(async () => {
    try {
      setCreatorsError(false);
      setCreators(await api<AdminCreator[]>("/admin/creators", await token()));
    } catch {
      setCreatorsError(true);
    }
  }, [token]);

  useEffect(() => {
    void loadDashboard();
    void loadProducts();
    void loadCreators();
  }, [loadDashboard, loadProducts, loadCreators]);

  async function toggleProductStatus(p: AdminProduct) {
    try {
      await api(`/admin/products/${p.id}`, await token(), {
        method: "PATCH",
        body: JSON.stringify({ status: p.status === "ativo" ? "pausado" : "ativo" }),
      });
      await loadDashboard();
      await loadProducts();
    } catch (error) {
      toast(friendlyError(error, "Não conseguimos atualizar o produto."));
    }
  }

  async function toggleCreator(c: AdminCreator) {
    try {
      await api(`/admin/creators/${c.id}/status`, await token(), {
        method: "PATCH",
        body: JSON.stringify({ status: c.status === "ativo" ? "bloqueado" : "ativo" }),
      });
      await loadDashboard();
      await loadCreators();
    } catch (error) {
      toast(friendlyError(error, "Não conseguimos atualizar o creator."));
    }
  }

  async function editProduct(id: string) {
    try {
      const data = await api<{ product: Record<string, unknown> }>(`/admin/products/${id}`, await token());
      const p = data.product;
      for (const key of Object.keys(EMPTY_FORM)) set(key, "");
      set("editing-product-id", p.id);
      set("product-external-id", p.produto_externo_id);
      set("product-name", p.nome);
      set("product-category", p.categoria);
      set("product-store", p.loja_nome);
      set("product-price-text", p.preco_texto);
      set("product-commission", p.comissao_percentual);
      set("product-price-min", p.preco_min_brl);
      set("product-price-max", p.preco_max_brl);
      set("product-region", p.pais_regiao);
      set("product-source-status", p.status_origem);
      set("product-sales-period", p.unidades_vendidas_periodo);
      set("product-sales-growth", p.crescimento_vendas_percentual);
      set("product-sales-total", p.unidades_vendidas_total);
      set("product-revenue-period", p.receita_periodo_brl);
      set("product-revenue-total", p.receita_total_brl);
      set("product-store-sales-total", p.unidades_vendidas_total_loja);
      set("product-upload-date", p.data_estimada_upload ? String(p.data_estimada_upload).slice(0, 16) : "");
      set("product-ranking", p.ranking_origem);
      set("product-description", p.descricao);
      set("product-image", p.imagem_url);
      set("product-tiktok-url", p.tiktok_shop_url);
      set("product-fastmoss-url", p.fastmoss_produto_url);
      set("product-store-fastmoss-url", p.fastmoss_loja_url);
      set("product-source", p.fonte_dados);
      set("product-status", (p.status as string) || "ativo");
      setEditing(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      toast(friendlyError(error, "Não conseguimos abrir o produto."));
    }
  }

  function cancelEdit() {
    (document.getElementById("product-form") as HTMLFormElement | null)?.reset();
    set("editing-product-id", "");
    setEditing(false);
  }

  async function uploadImage(file: File) {
    try {
      const { requireApiUrl } = await import("@/lib/config");
      const form = new FormData();
      form.append("file", file);
      const { data } = await supabase().auth.getSession();
      const res = await fetch(`${requireApiUrl()}/admin/products/image`, {
          method: "POST",
          headers: data.session?.access_token
            ? { Authorization: `Bearer ${data.session.access_token}` }
            : {},
          body: form,
        }
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message || `Erro ${res.status}`);
      set("product-image", body.imagem_url);
      toast("Imagem enviada ✓");
    } catch (error) {
      toast(friendlyError(error, "Não conseguimos enviar a imagem."));
    }
  }

  async function submitProduct(e: React.FormEvent) {
    e.preventDefault();
    const min = num("product-price-min");
    const max = num("product-price-max");
    if (min != null && max != null && min > max) {
      toast("Preço mínimo não pode ser maior que o máximo.");
      return;
    }
    const input = {
      produto_externo_id: get("product-external-id"),
      nome: get("product-name"),
      descricao: opt("product-description"),
      categoria: get("product-category"),
      imagem_url: get("product-image"),
      loja_nome: opt("product-store"),
      preco_texto: opt("product-price-text"),
      preco_min_brl: min,
      preco_max_brl: max,
      pais_regiao: opt("product-region"),
      comissao_percentual: num("product-commission"),
      unidades_vendidas_periodo: num("product-sales-period"),
      crescimento_vendas_percentual: num("product-sales-growth"),
      unidades_vendidas_total: num("product-sales-total"),
      receita_periodo_brl: num("product-revenue-period"),
      receita_total_brl: num("product-revenue-total"),
      data_estimada_upload: opt("product-upload-date"),
      unidades_vendidas_total_loja: num("product-store-sales-total"),
      fastmoss_produto_url: opt("product-fastmoss-url"),
      tiktok_shop_url: get("product-tiktok-url"),
      fastmoss_loja_url: opt("product-store-fastmoss-url"),
      status_origem: opt("product-source-status"),
      fonte_dados: opt("product-source"),
      ranking_origem: num("product-ranking"),
      status: get("product-status") || "ativo",
      destaque: false,
      ordem_destaque: 0,
    };
    setSaving(true);
    try {
      const id = get("editing-product-id");
      if (id) {
        await api(`/admin/products/${id}`, await token(), { method: "PATCH", body: JSON.stringify(input) });
        toast("Produto atualizado ✓");
      } else {
        await api("/admin/products", await token(), { method: "POST", body: JSON.stringify(input) });
        toast("Produto adicionado ao catálogo ✓");
      }
      cancelEdit();
      await loadDashboard();
      await loadProducts();
    } catch (error) {
      toast(friendlyError(error, "Não conseguimos salvar o produto. Confira os campos e tente novamente."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id="admin-view">
      <div className="hero-row">
        <div>
          <p className="eyebrow">ADMIN</p>
          <h1>Visão rápida do Beta</h1>
        </div>
        <button className="ghost" type="button" onClick={() => { void loadDashboard(); void loadProducts(); void loadCreators(); }}>
          Atualizar painel
        </button>
      </div>
      <div id="metrics" className="metrics">
        {metrics ? (
          Object.entries(metrics).map(([key, value]) => (
            <div key={key} className="metric">
              <span className="muted">{key.replaceAll("_", " ")}</span>
              <strong>{String(value)}</strong>
            </div>
          ))
        ) : metricsError ? (
          <div className="empty-state">
            <h3>Não conseguimos carregar as métricas.</h3>
            <button className="primary" type="button" onClick={() => void loadDashboard()}>
              Tentar novamente
            </button>
          </div>
        ) : (
          <p className="muted">Carregando métricas...</p>
        )}
      </div>

      <div className="card admin-form">
        <h2>{editing ? "Editar produto" : "Novo produto"}</h2>
        <p className="muted">Somente administradores cadastram produtos. A IA usa estas informações apenas para criar roteiros e orientações de gravação.</p>
        <form id="product-form" className="stack two-col" onSubmit={submitProduct}>
          <input id="editing-product-id" type="hidden" defaultValue="" />
          <label>ID do produto<input id="product-external-id" required maxLength={80} /></label>
          <label>Nome do produto<input id="product-name" required maxLength={500} /></label>
          <label>Categoria<input id="product-category" required maxLength={200} /></label>
          <label>Nome da loja<input id="product-store" maxLength={200} /></label>
          <label>Preço exibido<input id="product-price-text" placeholder="R$ 39,90 ou R$ 39,90 - 49,90" /></label>
          <label>Comissão (%)<input id="product-commission" type="number" min={0} max={100} step="0.01" /></label>
          <label>Preço mínimo (R$)<input id="product-price-min" type="number" min={0} step="0.01" /></label>
          <label>Preço máximo (R$)<input id="product-price-max" type="number" min={0} step="0.01" /></label>
          <label>País/Região<input id="product-region" maxLength={20} defaultValue="BR" /></label>
          <label>Status de origem<input id="product-source-status" maxLength={50} defaultValue="Disponível" /></label>
          <label>Unidades vendidas no período<input id="product-sales-period" type="number" min={0} step={1} /></label>
          <label>Crescimento das vendas (%)<input id="product-sales-growth" type="number" step="0.01" /></label>
          <label>Total de unidades vendidas<input id="product-sales-total" type="number" min={0} step={1} /></label>
          <label>Receita no período (R$)<input id="product-revenue-period" type="number" min={0} step="0.01" /></label>
          <label>Receita total (R$)<input id="product-revenue-total" type="number" min={0} step="0.01" /></label>
          <label>Total vendido pela loja<input id="product-store-sales-total" type="number" min={0} step={1} /></label>
          <label>Data estimada de upload<input id="product-upload-date" type="datetime-local" /></label>
          <label>Ranking<input id="product-ranking" type="number" min={1} step={1} /></label>
          <label className="wide">Descrição confirmada do produto<textarea id="product-description" maxLength={4000} placeholder="Use apenas informações verificadas." /></label>
          <label className="wide">Imagem URL<input id="product-image" type="url" required placeholder="https://..." /></label>
          <label className="wide">Ou envie uma imagem<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadImage(f); }} /></label>
          <label className="wide">Link do produto no TikTok Shop<input id="product-tiktok-url" type="url" required placeholder="https://shop.tiktok.com/..." /></label>
          <label className="wide">Link do produto no FastMoss<input id="product-fastmoss-url" type="url" placeholder="https://www.fastmoss.com/..." /></label>
          <label className="wide">Link da loja no FastMoss<input id="product-store-fastmoss-url" type="url" placeholder="https://www.fastmoss.com/..." /></label>
          <label>Fonte dos dados<input id="product-source" maxLength={255} defaultValue="Cadastro administrativo" /></label>
          <label>Status no catálogo
            <select id="product-status" defaultValue="ativo">
              <option value="ativo">Ativo</option>
              <option value="pausado">Pausado</option>
            </select>
          </label>
          <div className="wide">
            <button className="primary" type="submit" disabled={saving}>
              {saving ? "Salvando..." : editing ? "Salvar alterações" : "Adicionar produto"}
            </button>{" "}
            {editing && (
              <button className="ghost" type="button" onClick={cancelEdit}>
                Cancelar edição
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="card admin-form">
        <div className="hero-row">
          <div>
            <h2>Produtos ativos</h2>
            <p className="muted">Gerencie o catálogo disponível para creators.</p>
          </div>
          <button className="ghost" type="button" onClick={() => void loadProducts()}>
            Atualizar
          </button>
        </div>
        <div className="admin-list">
          {products === null ? (
            productsError ? (
              <div className="empty-state">
                <h3>Não conseguimos carregar os produtos.</h3>
                <button className="primary" type="button" onClick={() => void loadProducts()}>
                  Tentar novamente
                </button>
              </div>
            ) : (
              <p className="muted">Carregando produtos...</p>
            )
          ) : products.length ? (
            products.map((p) => (
              <div key={p.id} className="admin-row">
                <div>
                  <strong>{p.nome}</strong>
                  <span className="muted">
                    {[p.produto_externo_id ? `ID ${p.produto_externo_id}` : null, p.categoria || "Sem categoria", p.preco_texto, p.loja_nome, p.status].filter(Boolean).join(" · ")}
                  </span>
                </div>
                <div>
                  <button className="ghost edit-product" type="button" onClick={() => void editProduct(p.id)}>
                    Editar
                  </button>{" "}
                  <button className="ghost" type="button" onClick={() => void toggleProductStatus(p)}>
                    {p.status === "ativo" ? "Pausar" : "Ativar"}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="muted">Nenhum produto cadastrado.</p>
          )}
        </div>
      </div>

      <div className="card admin-form">
        <div className="hero-row">
          <div>
            <h2>Creators cadastrados</h2>
            <p className="muted">Acompanhe e modere os creators da plataforma.</p>
          </div>
          <button className="ghost" type="button" onClick={() => void loadCreators()}>
            Atualizar
          </button>
        </div>
        <div className="admin-list">
          {creators === null ? (
            creatorsError ? (
              <div className="empty-state">
                <h3>Não conseguimos carregar os creators.</h3>
                <button className="primary" type="button" onClick={() => void loadCreators()}>
                  Tentar novamente
                </button>
              </div>
            ) : (
              <p className="muted">Carregando creators...</p>
            )
          ) : creators.length ? (
            creators.map((c) => (
              <div key={c.id} className="admin-row">
                <div>
                  <strong>{c.nome || c.email || c.user_id}</strong>
                  <span className="muted">
                    {c.email || ""} · {(c.nicho || []).join(", ") || "Nicho não informado"} · {c.status}
                  </span>
                </div>
                <button className="ghost" type="button" onClick={() => void toggleCreator(c)}>
                  {c.status === "ativo" ? "Banir" : "Desbanir"}
                </button>
              </div>
            ))
          ) : (
            <p className="muted">Nenhum creator cadastrado.</p>
          )}
        </div>
      </div>
    </section>
  );
}
