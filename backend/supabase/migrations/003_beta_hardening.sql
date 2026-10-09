-- Beta invariants that belong in the database as well as in the API.
ALTER TABLE products
  ADD CONSTRAINT products_imagem_url_not_blank
  CHECK (imagem_url IS NULL OR btrim(imagem_url) <> '');

ALTER TABLE content_kits
  ADD CONSTRAINT content_kits_duracao_seg_positive
  CHECK (duracao_seg IS NULL OR duracao_seg > 0);

ALTER TABLE admins
  ADD CONSTRAINT admins_nivel_valid
  CHECK (nivel IS NULL OR nivel IN ('admin', 'owner'));

-- Ensure the product discovery queries remain predictable as the catalog grows.
CREATE INDEX IF NOT EXISTS idx_products_featured_order
  ON products (destaque DESC, ordem_destaque DESC, criado_em DESC);

-- A creator can save a given content kit only once.
CREATE UNIQUE INDEX IF NOT EXISTS uq_creator_content_creator_kit
  ON creator_content (creator_id, content_kit_id);
