-- Avoid per-row auth.uid() evaluation and keep ownership policies scoped to signed-in users.
DROP POLICY IF EXISTS creators_select_own ON public.creators;
CREATE POLICY creators_select_own ON public.creators
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS creators_insert_own ON public.creators;
CREATE POLICY creators_insert_own ON public.creators
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS creators_update_own ON public.creators;
CREATE POLICY creators_update_own ON public.creators
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS creator_content_select_own ON public.creator_content;
CREATE POLICY creator_content_select_own ON public.creator_content
  FOR SELECT TO authenticated
  USING (creator_id IN (SELECT id FROM public.creators WHERE user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS creator_content_insert_own ON public.creator_content;
CREATE POLICY creator_content_insert_own ON public.creator_content
  FOR INSERT TO authenticated
  WITH CHECK (creator_id IN (SELECT id FROM public.creators WHERE user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS creator_content_update_own ON public.creator_content;
CREATE POLICY creator_content_update_own ON public.creator_content
  FOR UPDATE TO authenticated
  USING (creator_id IN (SELECT id FROM public.creators WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (creator_id IN (SELECT id FROM public.creators WHERE user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS admins_select_own ON public.admins;
CREATE POLICY admins_select_own ON public.admins
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS idx_products_criado_por ON public.products(criado_por);
