DROP TABLE IF EXISTS public.credit_transactions CASCADE;

DROP FUNCTION IF EXISTS public.delete_user_account_atomic(uuid, text);
DROP FUNCTION IF EXISTS public.onboard_creator_atomic(uuid, text, text, text, text, text, text, text, text, integer, text, text[], text, text, text[], text[], text[], jsonb, jsonb, jsonb);
DROP FUNCTION IF EXISTS public.onboard_company_atomic(uuid, text, text, text, text, text, text, text, text[], integer, integer, text, text[], text[], text[], text[], text[], jsonb);
DROP FUNCTION IF EXISTS public.onboard_company_atomic(uuid, text, text, text, text, text, text, text, text[], integer, integer, text, text[], text[], text[], text[], text[], jsonb, jsonb, jsonb, jsonb, jsonb, jsonb);

REVOKE EXECUTE ON FUNCTION public.provision_creator_for_auth_user() FROM anon, authenticated;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
