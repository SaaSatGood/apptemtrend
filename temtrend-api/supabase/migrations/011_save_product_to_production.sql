-- A creator can start a production from a product before choosing a Content Kit.
ALTER TABLE public.creator_content
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE CASCADE;

UPDATE public.creator_content AS cc
SET product_id = ck.product_id
FROM public.content_kits AS ck
WHERE cc.content_kit_id = ck.id
  AND cc.product_id IS NULL;

ALTER TABLE public.creator_content
  ALTER COLUMN content_kit_id DROP NOT NULL,
  ALTER COLUMN product_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_creator_content_product_id
  ON public.creator_content(product_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_creator_content_creator_product
  ON public.creator_content(creator_id, product_id);

CREATE OR REPLACE FUNCTION public.sync_creator_content_product()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  kit_product_id uuid;
BEGIN
  IF NEW.content_kit_id IS NOT NULL THEN
    SELECT product_id INTO kit_product_id
    FROM public.content_kits
    WHERE id = NEW.content_kit_id;

    IF kit_product_id IS NULL THEN
      RAISE EXCEPTION 'Content Kit inválido.';
    END IF;

    IF NEW.product_id IS NULL THEN
      NEW.product_id := kit_product_id;
    ELSIF NEW.product_id <> kit_product_id THEN
      RAISE EXCEPTION 'O Content Kit não pertence ao produto informado.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_creator_content_product ON public.creator_content;
CREATE TRIGGER trg_sync_creator_content_product
  BEFORE INSERT OR UPDATE OF content_kit_id, product_id ON public.creator_content
  FOR EACH ROW EXECUTE FUNCTION public.sync_creator_content_product();

REVOKE EXECUTE ON FUNCTION public.sync_creator_content_product() FROM anon, authenticated;

