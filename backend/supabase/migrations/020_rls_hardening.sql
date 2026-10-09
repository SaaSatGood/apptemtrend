-- ============================================
-- TemTrend — 020 RLS hardening
-- Catálogo legível só por autenticados (evita anon key direta).
-- Mantém backend service_role como caminho oficial.
-- ============================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'products' AND policyname = 'products_select_active'
  ) THEN
    DROP POLICY products_select_active ON products;
  END IF;
END $$;

CREATE POLICY products_select_active ON products
  FOR SELECT TO authenticated
  USING (status = 'ativo');

-- Kits: leitura autenticada de produtos ativos (espelha backend pós-018).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'content_kits' AND policyname = 'content_kits_select_active'
  ) THEN
    DROP POLICY content_kits_select_active ON content_kits;
  END IF;
END $$;

CREATE POLICY content_kits_select_active ON content_kits
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = content_kits.product_id
      AND products.status = 'ativo'
    )
  );
