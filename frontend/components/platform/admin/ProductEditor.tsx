"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import Icon from "@/components/ui/Icon";
import { friendlyError } from "@/lib/api";
import { FALLBACK_IMAGE } from "@/lib/format";
import styles from "../Admin.module.css";
import { adminPatch, adminPost, adminToken } from "./api";
import { asNumber, optional, stringValue } from "./format";
import type { ProductFormState } from "./types";

export const EMPTY_FORM: ProductFormState = {
  externalId: "",
  name: "",
  category: "",
  store: "",
  priceText: "",
  commission: "",
  priceMin: "",
  priceMax: "",
  region: "BR",
  sourceStatus: "Disponível",
  salesPeriod: "",
  salesGrowth: "",
  salesTotal: "",
  revenuePeriod: "",
  revenueTotal: "",
  storeSalesTotal: "",
  uploadDate: "",
  ranking: "",
  description: "",
  image: "",
  tiktokUrl: "",
  fastmossUrl: "",
  storeFastmossUrl: "",
  source: "Cadastro administrativo",
  status: "ativo",
  featured: false,
  featuredOrder: "0",
};

export function formFromProduct(product: Record<string, unknown>): ProductFormState {
  return {
    externalId: stringValue(product.produto_externo_id),
    name: stringValue(product.nome),
    category: stringValue(product.categoria),
    store: stringValue(product.loja_nome),
    priceText: stringValue(product.preco_texto),
    commission: stringValue(product.comissao_percentual),
    priceMin: stringValue(product.preco_min_brl),
    priceMax: stringValue(product.preco_max_brl),
    region: stringValue(product.pais_regiao) || "BR",
    sourceStatus: stringValue(product.status_origem) || "Disponível",
    salesPeriod: stringValue(product.unidades_vendidas_periodo),
    salesGrowth: stringValue(product.crescimento_vendas_percentual),
    salesTotal: stringValue(product.unidades_vendidas_total),
    revenuePeriod: stringValue(product.receita_periodo_brl),
    revenueTotal: stringValue(product.receita_total_brl),
    storeSalesTotal: stringValue(product.unidades_vendidas_total_loja),
    uploadDate: product.data_estimada_upload ? String(product.data_estimada_upload).slice(0, 16) : "",
    ranking: stringValue(product.ranking_origem),
    description: stringValue(product.descricao),
    image: stringValue(product.imagem_url),
    tiktokUrl: stringValue(product.tiktok_shop_url),
    fastmossUrl: stringValue(product.fastmoss_product_url),
    storeFastmossUrl: stringValue(product.fastmoss_loja_url),
    source: stringValue(product.fonte_dados) || "Cadastro administrativo",
    status: product.status === "pausado" ? "pausado" : "ativo",
    featured: Boolean(product.destaque),
    featuredOrder: stringValue(product.ordem_destaque) || "0",
  };
}

export function payloadFromForm(form: ProductFormState) {
  return {
    produto_externo_id: optional(form.externalId),
    nome: form.name.trim(),
    descricao: optional(form.description),
    categoria: optional(form.category),
    imagem_url: form.image.trim(),
    loja_nome: optional(form.store),
    preco_texto: optional(form.priceText),
    preco_min_brl: asNumber(form.priceMin),
    preco_max_brl: asNumber(form.priceMax),
    pais_regiao: optional(form.region),
    comissao_percentual: asNumber(form.commission),
    unidades_vendidas_periodo: asNumber(form.salesPeriod),
    crescimento_vendas_percentual: asNumber(form.salesGrowth),
    unidades_vendidas_total: asNumber(form.salesTotal),
    receita_periodo_brl: asNumber(form.revenuePeriod),
    receita_total_brl: asNumber(form.revenueTotal),
    data_estimada_upload: optional(form.uploadDate),
    unidades_vendidas_total_loja: asNumber(form.storeSalesTotal),
    fastmoss_produto_url: optional(form.fastmossUrl),
    tiktok_shop_url: optional(form.tiktokUrl),
    fastmoss_loja_url: optional(form.storeFastmossUrl),
    status_origem: optional(form.sourceStatus),
    fonte_dados: optional(form.source),
    ranking_origem: asNumber(form.ranking),
    status: form.status,
    destaque: form.featured,
    ordem_destaque: asNumber(form.featuredOrder) ?? 0,
  };
}

export default function ProductEditor({
  editingId,
  initialForm,
  categories,
  token,
  onClose,
  onSaved,
  onToast,
}: {
  editingId: string | null;
  initialForm: ProductFormState;
  categories: string[];
  token?: string;
  onClose: () => void;
  onSaved: () => void;
  onToast: (message: string) => void;
}) {
  const [form, setForm] = useState<ProductFormState>(initialForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  function patch<K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function uploadImage(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      onToast("A imagem deve ter no máximo 5 MB.");
      return;
    }
    setUploading(true);
    try {
      const { requireApiUrl } = await import("@/lib/config");
      const body = new FormData();
      body.append("file", file);
      const accessToken = token ?? (await adminToken());
      const response = await fetch(`${requireApiUrl()}/admin/products/image`, {
        method: "POST",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        body,
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error?.message || `Erro ${response.status}`);
      patch("image", result.imagem_url);
      onToast("Imagem enviada.");
    } catch (error) {
      onToast(friendlyError(error, "Não conseguimos enviar a imagem."));
    } finally {
      setUploading(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const min = asNumber(form.priceMin);
    const max = asNumber(form.priceMax);
    if (min != null && max != null && min > max) {
      onToast("O preço mínimo não pode ser maior que o máximo.");
      return;
    }
    if (!form.name.trim()) {
      onToast("Informe o nome do produto.");
      return;
    }
    setSaving(true);
    try {
      const accessToken = token ?? (await adminToken());
      if (editingId) {
        await adminPatch(`/admin/products/${editingId}`, payloadFromForm(form), accessToken);
        onToast("Produto atualizado.");
      } else {
        await adminPost("/admin/products", payloadFromForm(form), accessToken);
        onToast("Produto adicionado ao catálogo.");
      }
      onSaved();
    } catch (error) {
      onToast(friendlyError(error, "Não conseguimos salvar o produto. Revise os campos e tente novamente."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.editor}>
      <div className={styles.editorHeading}>
        <div>
          <span>{editingId ? "Editando produto" : "Novo produto"}</span>
          <h2>{editingId ? form.name || "Produto" : "Adicionar ao catálogo"}</h2>
          <p>Organize os dados que alimentam a descoberta e os roteiros de conteúdo.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar formulário">
          <Icon name="x" size={18} />
        </button>
      </div>
      <form onSubmit={submit} className={styles.productForm}>
        <fieldset>
          <legend>
            <b>1</b>
            <span>Identificação<small>Informações que o creator verá primeiro.</small></span>
          </legend>
          <div className={styles.formGrid}>
            <label className={styles.wide}>
              Nome do produto
              <input value={form.name} onChange={(event) => patch("name", event.target.value)} required maxLength={500} />
            </label>
            <label>
              ID externo
              <input value={form.externalId} onChange={(event) => patch("externalId", event.target.value)} maxLength={80} placeholder="ID do TikTok Shop" />
            </label>
            <label>
              Categoria
              <input value={form.category} onChange={(event) => patch("category", event.target.value)} list="admin-categories" maxLength={200} />
              <datalist id="admin-categories">
                {categories.map((category) => <option key={category} value={category} />)}
              </datalist>
            </label>
            <label>Loja<input value={form.store} onChange={(event) => patch("store", event.target.value)} maxLength={200} /></label>
            <label>País/Região<input value={form.region} onChange={(event) => patch("region", event.target.value)} maxLength={20} /></label>
            <label className={styles.wide}>
              Descrição confirmada
              <textarea value={form.description} onChange={(event) => patch("description", event.target.value)} maxLength={4000} rows={4} placeholder="Use apenas informações verificadas sobre o produto." />
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>
            <b>2</b>
            <span>Preço e performance<small>Dados usados para ordenar e contextualizar oportunidades.</small></span>
          </legend>
          <div className={styles.formGrid}>
            <label>Preço exibido<input value={form.priceText} onChange={(event) => patch("priceText", event.target.value)} placeholder="R$ 39,90 – 49,90" /></label>
            <label>Comissão (%)<input value={form.commission} onChange={(event) => patch("commission", event.target.value)} type="number" min={0} max={100} step="0.01" /></label>
            <label>Preço mínimo (R$)<input value={form.priceMin} onChange={(event) => patch("priceMin", event.target.value)} type="number" min={0} step="0.01" /></label>
            <label>Preço máximo (R$)<input value={form.priceMax} onChange={(event) => patch("priceMax", event.target.value)} type="number" min={0} step="0.01" /></label>
            <label>Vendas no período<input value={form.salesPeriod} onChange={(event) => patch("salesPeriod", event.target.value)} type="number" min={0} step={1} /></label>
            <label>Crescimento (%)<input value={form.salesGrowth} onChange={(event) => patch("salesGrowth", event.target.value)} type="number" step="0.01" /></label>
            <label>Total vendido<input value={form.salesTotal} onChange={(event) => patch("salesTotal", event.target.value)} type="number" min={0} step={1} /></label>
            <label>Vendas da loja<input value={form.storeSalesTotal} onChange={(event) => patch("storeSalesTotal", event.target.value)} type="number" min={0} step={1} /></label>
            <label>Receita no período (R$)<input value={form.revenuePeriod} onChange={(event) => patch("revenuePeriod", event.target.value)} type="number" min={0} step="0.01" /></label>
            <label>Receita total (R$)<input value={form.revenueTotal} onChange={(event) => patch("revenueTotal", event.target.value)} type="number" min={0} step="0.01" /></label>
            <label>Ranking<input value={form.ranking} onChange={(event) => patch("ranking", event.target.value)} type="number" min={1} step={1} /></label>
            <label>Data estimada de upload<input value={form.uploadDate} onChange={(event) => patch("uploadDate", event.target.value)} type="datetime-local" /></label>
          </div>
        </fieldset>

        <fieldset>
          <legend>
            <b>3</b>
            <span>Mídia e links<small>Revise a imagem antes de publicar.</small></span>
          </legend>
          <div className={styles.mediaEditor}>
            <div className={styles.imagePreview}>
              <img
                src={form.image || FALLBACK_IMAGE}
                alt="Prévia do produto"
                width={320}
                height={320}
                onError={(event) => { event.currentTarget.src = FALLBACK_IMAGE; }}
              />
              <span>{form.image ? "Prévia atual" : "Sem imagem"}</span>
            </div>
            <div className={styles.mediaFields}>
              <label>URL da imagem<input value={form.image} onChange={(event) => patch("image", event.target.value)} type="url" required placeholder="https://..." /></label>
              <label className={styles.fileField}>
                Enviar nova imagem
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  disabled={uploading}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadImage(file);
                  }}
                />
                <span>{uploading ? "Enviando…" : "JPG, PNG, WebP ou GIF · até 5 MB"}</span>
              </label>
              <label>Link no TikTok Shop<input value={form.tiktokUrl} onChange={(event) => patch("tiktokUrl", event.target.value)} type="url" placeholder="https://shop.tiktok.com/..." /></label>
              <label>Link do produto no FastMoss<input value={form.fastmossUrl} onChange={(event) => patch("fastmossUrl", event.target.value)} type="url" placeholder="https://www.fastmoss.com/..." /></label>
              <label>Link da loja no FastMoss<input value={form.storeFastmossUrl} onChange={(event) => patch("storeFastmossUrl", event.target.value)} type="url" placeholder="https://www.fastmoss.com/..." /></label>
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend>
            <b>4</b>
            <span>Publicação<small>Controle onde e como o produto aparece.</small></span>
          </legend>
          <div className={styles.formGrid}>
            <label>Fonte dos dados<input value={form.source} onChange={(event) => patch("source", event.target.value)} maxLength={255} /></label>
            <label>Status na fonte<input value={form.sourceStatus} onChange={(event) => patch("sourceStatus", event.target.value)} maxLength={50} /></label>
            <label>
              Status no catálogo
              <select value={form.status} onChange={(event) => patch("status", event.target.value as ProductFormState["status"])}>
                <option value="ativo">Ativo</option>
                <option value="pausado">Pausado</option>
              </select>
            </label>
            <label>Ordem de destaque<input value={form.featuredOrder} onChange={(event) => patch("featuredOrder", event.target.value)} type="number" min={0} step={1} disabled={!form.featured} /></label>
            <label className={`${styles.wide} ${styles.checkField}`}>
              <input checked={form.featured} onChange={(event) => patch("featured", event.target.checked)} type="checkbox" />
              <span>
                <strong>Destacar produto</strong>
                <small>Prioriza esta oportunidade nas áreas de descoberta.</small>
              </span>
            </label>
          </div>
        </fieldset>

        <div className={styles.formActions}>
          <button className={styles.secondaryButton} type="button" onClick={onClose}>Cancelar</button>
          <button className={styles.primaryButton} type="submit" disabled={saving || uploading}>
            {saving ? "Salvando…" : editingId ? "Salvar alterações" : "Adicionar produto"}
          </button>
        </div>
      </form>
    </div>
  );
}
