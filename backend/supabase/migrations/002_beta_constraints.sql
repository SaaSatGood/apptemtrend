-- Prevent duplicate opportunities when two save requests arrive concurrently.
CREATE UNIQUE INDEX IF NOT EXISTS uq_creator_content_creator_kit
  ON creator_content (creator_id, content_kit_id);

-- Storage writes are performed by the backend with the service role.
DROP POLICY IF EXISTS storage_products_upload ON storage.objects;
DROP POLICY IF EXISTS storage_products_update ON storage.objects;
DROP POLICY IF EXISTS storage_products_delete ON storage.objects;

CREATE POLICY storage_products_upload ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'products' AND EXISTS (
      SELECT 1 FROM public.admins WHERE user_id = auth.uid()
    )
  );

CREATE POLICY storage_products_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'products' AND EXISTS (
      SELECT 1 FROM public.admins WHERE user_id = auth.uid()
    )
  );

CREATE POLICY storage_products_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'products' AND EXISTS (
      SELECT 1 FROM public.admins WHERE user_id = auth.uid()
    )
  );
