-- ============================================
-- TemTrend — 019 performance indexes
-- Cobre filtros quentes: catálogo ativo, produção por creator, kits por produto.
-- ============================================

-- Catálogo: status + ordenação + filtro categoria/destaque
CREATE INDEX IF NOT EXISTS idx_products_status_ordem_criado
  ON products(status, ordem_destaque DESC, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_products_status_categoria
  ON products(status, categoria);

CREATE INDEX IF NOT EXISTS idx_products_imagem_url
  ON products(imagem_url)
  WHERE status = 'ativo';

-- Produção: lista por creator + lookup produto/kit
CREATE INDEX IF NOT EXISTS idx_creator_content_creator_atualizado
  ON creator_content(creator_id, atualizado_em DESC);

CREATE INDEX IF NOT EXISTS idx_creator_content_creator_product
  ON creator_content(creator_id, product_id);

CREATE INDEX IF NOT EXISTS idx_creator_content_creator_kit
  ON creator_content(creator_id, content_kit_id);

-- Kits: produto + dono + recência
CREATE INDEX IF NOT EXISTS idx_content_kits_product_creator_criado
  ON content_kits(product_id, creator_id, criado_em DESC);

-- Creators/admins: lookup por user
CREATE INDEX IF NOT EXISTS idx_admins_user_id ON admins(user_id);
