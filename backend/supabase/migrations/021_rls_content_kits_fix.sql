-- ============================================
-- TemTrend — 021 RLS fix (não editar migrations anteriores)
-- 020 recriou content_kits_select_active e anulou a
-- privatização de 018 (policies fazem OR).
-- Esta migration remove a leitura ampla e mantém kits
-- privados por creator (backend filtra por creator_id).
-- Também endurece creators UPDATE com WITH CHECK.
-- ============================================

DROP POLICY IF EXISTS content_kits_select_active ON public.content_kits;

-- Garante que a policy privada de 018 exista (idempotente).
DROP POLICY IF EXISTS content_kits_select_own ON public.content_kits;
CREATE POLICY content_kits_select_own ON public.content_kits
  FOR SELECT TO authenticated
  USING (
    creator_id IN (
      SELECT id FROM public.creators WHERE user_id = auth.uid()
    )
  );

-- Creators: impedir troca de user_id via UPDATE direto (defesa em
-- profundidade; writes já são service_role/trigger desde 004).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'creators' AND policyname = 'creators_update_own'
  ) THEN
    DROP POLICY creators_update_own ON public.creators;
  END IF;
END $$;

CREATE POLICY creators_update_own ON public.creators
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
