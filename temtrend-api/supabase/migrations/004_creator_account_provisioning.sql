-- Every new non-admin Auth account is provisioned as a creator.
-- Admins remain an explicit operational exception in public.admins.
CREATE OR REPLACE FUNCTION public.provision_creator_for_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admins WHERE user_id = NEW.id)
     AND NOT EXISTS (SELECT 1 FROM public.creators WHERE user_id = NEW.id) THEN
    INSERT INTO public.creators (user_id) VALUES (NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_provision_creator_on_auth_user ON auth.users;
CREATE TRIGGER trg_provision_creator_on_auth_user
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.provision_creator_for_auth_user();

-- Backfill existing non-admin accounts created before this rule.
INSERT INTO public.creators (user_id)
SELECT u.id
FROM auth.users AS u
WHERE NOT EXISTS (SELECT 1 FROM public.admins AS a WHERE a.user_id = u.id)
  AND NOT EXISTS (SELECT 1 FROM public.creators AS c WHERE c.user_id = u.id);

REVOKE INSERT, UPDATE, DELETE ON public.creators FROM anon, authenticated;
