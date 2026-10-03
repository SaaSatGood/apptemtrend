-- Content Kits are private, creator-specific creative assets.
ALTER TABLE public.content_kits
  ADD COLUMN creator_id UUID REFERENCES public.creators(id) ON DELETE CASCADE,
  ADD COLUMN briefing_usuario TEXT;

-- Preserve ownership for kits already connected to one or more productions.
WITH owners AS (
  SELECT DISTINCT ON (content_kit_id) content_kit_id, creator_id
  FROM public.creator_content
  WHERE content_kit_id IS NOT NULL
  ORDER BY content_kit_id, criado_em
)
UPDATE public.content_kits AS kit
SET creator_id = owners.creator_id
FROM owners
WHERE kit.id = owners.content_kit_id;

-- If a legacy kit was shared, give every additional creator a private copy.
DO $$
DECLARE
  link RECORD;
  private_kit_id UUID;
BEGIN
  FOR link IN
    SELECT DISTINCT cc.content_kit_id, cc.creator_id
    FROM public.creator_content AS cc
    JOIN public.content_kits AS kit ON kit.id = cc.content_kit_id
    WHERE cc.content_kit_id IS NOT NULL
      AND kit.creator_id IS DISTINCT FROM cc.creator_id
  LOOP
    INSERT INTO public.content_kits (
      product_id, creator_id, titulo, descricao, formato, plataforma,
      nivel_dificuldade, hook, roteiro, cenas, copy, cta, hashtags,
      audio_sugerido, duracao_seg, briefing_usuario
    )
    SELECT
      product_id, link.creator_id, titulo, descricao, formato, plataforma,
      nivel_dificuldade, hook, roteiro, cenas, copy, cta, hashtags,
      audio_sugerido, duracao_seg, briefing_usuario
    FROM public.content_kits
    WHERE id = link.content_kit_id
    RETURNING id INTO private_kit_id;

    UPDATE public.creator_content
    SET content_kit_id = private_kit_id
    WHERE content_kit_id = link.content_kit_id
      AND creator_id = link.creator_id;
  END LOOP;
END;
$$;

CREATE INDEX idx_content_kits_creator_product
  ON public.content_kits (creator_id, product_id, criado_em DESC);

DROP POLICY IF EXISTS content_kits_select_active ON public.content_kits;
CREATE POLICY content_kits_select_own ON public.content_kits
  FOR SELECT TO authenticated
  USING (
    creator_id IN (
      SELECT id FROM public.creators WHERE user_id = auth.uid()
    )
  );

ALTER TABLE public.content_kits
  ADD CONSTRAINT content_kits_briefing_length
  CHECK (briefing_usuario IS NULL OR char_length(briefing_usuario) <= 1500);
