-- TikTok OAuth, account and Direct Post operational data.
CREATE TABLE IF NOT EXISTS public.tiktok_oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tiktok_oauth_states_expires_at
  ON public.tiktok_oauth_states(expires_at);

CREATE TABLE IF NOT EXISTS public.tiktok_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL UNIQUE REFERENCES public.creators(id) ON DELETE CASCADE,
  open_id TEXT NOT NULL UNIQUE,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  scope TEXT NOT NULL,
  access_token_expires_at TIMESTAMPTZ NOT NULL,
  refresh_token_expires_at TIMESTAMPTZ,
  token_type TEXT NOT NULL DEFAULT 'Bearer',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'error')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tiktok_accounts_creator_id
  ON public.tiktok_accounts(creator_id);

CREATE TABLE IF NOT EXISTS public.tiktok_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  creator_content_id UUID REFERENCES public.creator_content(id) ON DELETE SET NULL,
  content_kit_id UUID REFERENCES public.content_kits(id) ON DELETE SET NULL,
  tiktok_account_id UUID NOT NULL REFERENCES public.tiktok_accounts(id) ON DELETE RESTRICT,
  storage_path TEXT NOT NULL,
  file_size BIGINT NOT NULL CHECK (file_size > 0),
  mime_type TEXT NOT NULL,
  caption TEXT,
  privacy_level TEXT,
  publish_id TEXT,
  tiktok_post_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'uploading', 'processing', 'published', 'failed', 'cancelled')),
  error_code TEXT,
  error_message TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tiktok_posts_creator_id ON public.tiktok_posts(creator_id);
CREATE INDEX IF NOT EXISTS idx_tiktok_posts_publish_id ON public.tiktok_posts(publish_id);
CREATE INDEX IF NOT EXISTS idx_tiktok_posts_status ON public.tiktok_posts(status);
CREATE INDEX IF NOT EXISTS idx_tiktok_posts_creator_content_id ON public.tiktok_posts(creator_content_id);

CREATE OR REPLACE FUNCTION public.touch_tiktok_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tiktok_accounts_updated_at ON public.tiktok_accounts;
CREATE TRIGGER trg_tiktok_accounts_updated_at
  BEFORE UPDATE ON public.tiktok_accounts
  FOR EACH ROW EXECUTE FUNCTION public.touch_tiktok_updated_at();

DROP TRIGGER IF EXISTS trg_tiktok_posts_updated_at ON public.tiktok_posts;
CREATE TRIGGER trg_tiktok_posts_updated_at
  BEFORE UPDATE ON public.tiktok_posts
  FOR EACH ROW EXECUTE FUNCTION public.touch_tiktok_updated_at();

ALTER TABLE public.tiktok_oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiktok_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiktok_posts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.tiktok_oauth_states FROM anon, authenticated;
REVOKE ALL ON public.tiktok_accounts FROM anon, authenticated;
REVOKE ALL ON public.tiktok_posts FROM anon, authenticated;

GRANT SELECT (id, creator_id, username, display_name, avatar_url, status, created_at, updated_at)
  ON public.tiktok_accounts TO authenticated;
GRANT SELECT (id, creator_id, creator_content_id, content_kit_id, tiktok_account_id, file_size, mime_type, caption, privacy_level, publish_id, tiktok_post_id, status, error_code, error_message, attempt_count, created_at, updated_at, published_at)
  ON public.tiktok_posts TO authenticated;

DROP POLICY IF EXISTS tiktok_accounts_select_own ON public.tiktok_accounts;
CREATE POLICY tiktok_accounts_select_own ON public.tiktok_accounts
  FOR SELECT USING (creator_id IN (SELECT id FROM public.creators WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS tiktok_posts_select_own ON public.tiktok_posts;
CREATE POLICY tiktok_posts_select_own ON public.tiktok_posts
  FOR SELECT USING (creator_id IN (SELECT id FROM public.creators WHERE user_id = auth.uid()));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'creator-videos',
  'creator-videos',
  false,
  4294967296,
  ARRAY['video/mp4', 'video/quicktime', 'video/webm']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

