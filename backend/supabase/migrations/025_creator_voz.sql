-- 025: voz do creator + flag de personalização do kit.
-- voz_exemplo: amostra curta do jeito de falar (usada no prompt de geração).
-- usou_voz: marca kits gerados com a voz aplicada.

ALTER TABLE public.creators
  ADD COLUMN IF NOT EXISTS voz_exemplo TEXT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'creators_voz_length'
  ) THEN
    ALTER TABLE public.creators
      ADD CONSTRAINT creators_voz_length
      CHECK (voz_exemplo IS NULL OR char_length(voz_exemplo) <= 500);
  END IF;
END $$;

ALTER TABLE public.content_kits
  ADD COLUMN IF NOT EXISTS usou_voz BOOLEAN NOT NULL DEFAULT false;
