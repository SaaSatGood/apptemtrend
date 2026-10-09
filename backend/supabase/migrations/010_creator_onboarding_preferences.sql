-- Lightweight onboarding preferences used to personalize the creator experience.
ALTER TABLE public.creators
  ADD COLUMN IF NOT EXISTS objetivo TEXT,
  ADD COLUMN IF NOT EXISTS estilos_conteudo TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS temas_interesse TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS onboarding_completo BOOLEAN NOT NULL DEFAULT FALSE;

-- Preserve the state of creators who completed the previous onboarding flow.
UPDATE public.creators
SET onboarding_completo = TRUE
WHERE onboarding_completo = FALSE
  AND (cardinality(nicho) > 0 OR cardinality(plataformas) > 0);

