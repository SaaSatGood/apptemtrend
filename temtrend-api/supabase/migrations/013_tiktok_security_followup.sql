-- Follow-up from Supabase security/performance advisors.
REVOKE EXECUTE ON FUNCTION public.sync_creator_content_product() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.touch_tiktok_updated_at() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS tiktok_oauth_states_no_client_access ON public.tiktok_oauth_states;
CREATE POLICY tiktok_oauth_states_no_client_access ON public.tiktok_oauth_states
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS tiktok_accounts_select_own ON public.tiktok_accounts;
CREATE POLICY tiktok_accounts_select_own ON public.tiktok_accounts
  FOR SELECT TO authenticated
  USING (creator_id IN (
    SELECT id FROM public.creators WHERE user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS tiktok_posts_select_own ON public.tiktok_posts;
CREATE POLICY tiktok_posts_select_own ON public.tiktok_posts
  FOR SELECT TO authenticated
  USING (creator_id IN (
    SELECT id FROM public.creators WHERE user_id = (SELECT auth.uid())
  ));

CREATE INDEX IF NOT EXISTS idx_tiktok_oauth_states_user_id
  ON public.tiktok_oauth_states(user_id);
CREATE INDEX IF NOT EXISTS idx_tiktok_posts_content_kit_id
  ON public.tiktok_posts(content_kit_id);
CREATE INDEX IF NOT EXISTS idx_tiktok_posts_tiktok_account_id
  ON public.tiktok_posts(tiktok_account_id);
