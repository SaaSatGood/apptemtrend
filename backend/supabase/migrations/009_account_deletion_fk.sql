-- Allow an account to be deleted without deleting the catalog it created.
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'products'
    AND con.contype = 'f'
    AND pg_get_constraintdef(con.oid) ILIKE '%(criado_por)%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.products DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.products
  ADD CONSTRAINT products_criado_por_fkey
  FOREIGN KEY (criado_por) REFERENCES auth.users(id) ON DELETE SET NULL;
