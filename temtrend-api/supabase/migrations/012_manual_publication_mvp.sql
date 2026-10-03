-- Keep the MVP focused on manual publication links and Content Kit production.
DROP TABLE IF EXISTS public.tiktok_posts CASCADE;
DROP TABLE IF EXISTS public.tiktok_accounts CASCADE;
DROP TABLE IF EXISTS public.tiktok_oauth_states CASCADE;
DROP FUNCTION IF EXISTS public.touch_tiktok_updated_at();

-- A creator may produce multiple Content Kits from the same product, but never
-- duplicate the same Content Kit. Product-only saves remain unique.
DROP INDEX IF EXISTS public.uq_creator_content_creator_product;

CREATE UNIQUE INDEX IF NOT EXISTS uq_creator_content_creator_kit
  ON public.creator_content(creator_id, content_kit_id)
  WHERE content_kit_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_creator_content_creator_product_only
  ON public.creator_content(creator_id, product_id)
  WHERE content_kit_id IS NULL;

REVOKE EXECUTE ON FUNCTION public.sync_creator_content_product() FROM PUBLIC, anon, authenticated;
