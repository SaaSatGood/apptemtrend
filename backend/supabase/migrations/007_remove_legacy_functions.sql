DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('delete_user_account_atomic', 'onboard_creator_atomic', 'onboard_company_atomic')
  LOOP
    EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || r.signature || ' FROM anon, authenticated';
    EXECUTE 'DROP FUNCTION ' || r.signature;
  END LOOP;
END $$;
REVOKE EXECUTE ON FUNCTION public.provision_creator_for_auth_user() FROM anon, authenticated;
