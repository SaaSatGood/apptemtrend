-- Product facts used by the admin catalog and by AI-generated recording guidance.
-- Only admins write products. The AI only reads these fields to create Content Kits.
ALTER TABLE public.products
  ADD COLUMN produto_externo_id TEXT,
  ADD COLUMN loja_nome TEXT,
  ADD COLUMN preco_texto TEXT,
  ADD COLUMN preco_min_brl NUMERIC(12, 2),
  ADD COLUMN preco_max_brl NUMERIC(12, 2),
  ADD COLUMN pais_regiao TEXT,
  ADD COLUMN comissao_percentual NUMERIC(8, 2),
  ADD COLUMN unidades_vendidas_periodo BIGINT,
  ADD COLUMN crescimento_vendas_percentual NUMERIC(12, 2),
  ADD COLUMN unidades_vendidas_total BIGINT,
  ADD COLUMN receita_periodo_brl NUMERIC(16, 2),
  ADD COLUMN receita_total_brl NUMERIC(16, 2),
  ADD COLUMN data_estimada_upload TIMESTAMPTZ,
  ADD COLUMN unidades_vendidas_total_loja BIGINT,
  ADD COLUMN fastmoss_produto_url TEXT,
  ADD COLUMN tiktok_shop_url TEXT,
  ADD COLUMN fastmoss_loja_url TEXT,
  ADD COLUMN status_origem TEXT,
  ADD COLUMN fonte_dados TEXT,
  ADD COLUMN ranking_origem INTEGER;

ALTER TABLE public.products
  ADD CONSTRAINT products_produto_externo_id_key UNIQUE (produto_externo_id),
  ADD CONSTRAINT products_preco_min_nonnegative CHECK (preco_min_brl IS NULL OR preco_min_brl >= 0),
  ADD CONSTRAINT products_preco_max_nonnegative CHECK (preco_max_brl IS NULL OR preco_max_brl >= 0),
  ADD CONSTRAINT products_price_range_valid CHECK (
    preco_min_brl IS NULL OR preco_max_brl IS NULL OR preco_max_brl >= preco_min_brl
  ),
  ADD CONSTRAINT products_commission_range CHECK (
    comissao_percentual IS NULL OR comissao_percentual BETWEEN 0 AND 100
  ),
  ADD CONSTRAINT products_units_nonnegative CHECK (
    (unidades_vendidas_periodo IS NULL OR unidades_vendidas_periodo >= 0)
    AND (unidades_vendidas_total IS NULL OR unidades_vendidas_total >= 0)
    AND (unidades_vendidas_total_loja IS NULL OR unidades_vendidas_total_loja >= 0)
  );

CREATE INDEX idx_products_catalog_search ON public.products (categoria, status, unidades_vendidas_periodo DESC);
