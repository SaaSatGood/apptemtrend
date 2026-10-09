-- ============================================
-- TemTrend Beta — Initial Schema
-- ============================================

-- 1. Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 2. CREATORS
-- ============================================
CREATE TABLE creators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nicho TEXT[] DEFAULT '{}',
  plataformas TEXT[] DEFAULT '{}',
  tem_conta_afiliada BOOLEAN DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'bloqueado')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_creators_user_id ON creators(user_id);

CREATE TRIGGER trg_creators_updated_at
  BEFORE UPDATE ON creators
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. PRODUCTS
-- ============================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT,
  imagem_url TEXT,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'pausado')),
  destaque BOOLEAN DEFAULT FALSE,
  ordem_destaque INTEGER DEFAULT 0,
  criado_por UUID REFERENCES auth.users(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_destaque ON products(destaque);

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 4. CONTENT_KITS
-- ============================================
CREATE TABLE content_kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  formato TEXT,
  plataforma TEXT,
  nivel_dificuldade TEXT,
  hook TEXT,
  roteiro TEXT,
  cenas JSONB,
  copy TEXT,
  cta TEXT,
  hashtags TEXT[] DEFAULT '{}',
  audio_sugerido TEXT,
  duracao_seg INTEGER,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_kits_product_id ON content_kits(product_id);

CREATE TRIGGER trg_content_kits_updated_at
  BEFORE UPDATE ON content_kits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. CREATOR_CONTENT
-- ============================================
CREATE TABLE creator_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  content_kit_id UUID NOT NULL REFERENCES content_kits(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'salvo' CHECK (status IN ('salvo', 'em_producao', 'gravado', 'publicado')),
  notas TEXT,
  published_url TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_creator_content_creator_id ON creator_content(creator_id);
CREATE INDEX idx_creator_content_content_kit_id ON creator_content(content_kit_id);
CREATE INDEX idx_creator_content_status ON creator_content(status);

CREATE TRIGGER trg_creator_content_updated_at
  BEFORE UPDATE ON creator_content
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. ADMINS
-- ============================================
CREATE TABLE admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nivel TEXT DEFAULT 'admin'
);

-- ============================================
-- 7. CREATOR_INVITES
-- ============================================
CREATE TABLE creator_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_creator_invites_token ON creator_invites(token);
CREATE INDEX idx_creator_invites_email ON creator_invites(email);

-- ============================================
-- 8. RLS POLICIES
-- ============================================

-- CREATORS
ALTER TABLE creators ENABLE ROW LEVEL SECURITY;

CREATE POLICY creators_select_own ON creators
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY creators_insert_own ON creators
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY creators_update_own ON creators
  FOR UPDATE USING (auth.uid() = user_id);

-- PRODUCTS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY products_select_active ON products
  FOR SELECT USING (status = 'ativo');

-- CONTENT_KITS
ALTER TABLE content_kits ENABLE ROW LEVEL SECURITY;

CREATE POLICY content_kits_select_active ON content_kits
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = content_kits.product_id
      AND products.status = 'ativo'
    )
  );

-- CREATOR_CONTENT
ALTER TABLE creator_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY creator_content_select_own ON creator_content
  FOR SELECT USING (
    creator_id IN (
      SELECT id FROM creators WHERE user_id = auth.uid()
    )
  );

CREATE POLICY creator_content_insert_own ON creator_content
  FOR INSERT WITH CHECK (
    creator_id IN (
      SELECT id FROM creators WHERE user_id = auth.uid()
    )
  );

CREATE POLICY creator_content_update_own ON creator_content
  FOR UPDATE USING (
    creator_id IN (
      SELECT id FROM creators WHERE user_id = auth.uid()
    )
  );

-- ADMINS
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY admins_select_own ON admins
  FOR SELECT USING (auth.uid() = user_id);

-- CREATOR_INVITES
ALTER TABLE creator_invites ENABLE ROW LEVEL SECURITY;
-- No public policies — managed via service role only

-- ============================================
-- 9. STORAGE BUCKET
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: authenticated users can upload, public can read
CREATE POLICY storage_products_upload ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'products');

CREATE POLICY storage_products_read ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'products');

CREATE POLICY storage_products_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'products');

CREATE POLICY storage_products_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'products');
