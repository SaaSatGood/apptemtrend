-- Prevent concurrent pending/uploading/processing posts for the same production item.
CREATE UNIQUE INDEX IF NOT EXISTS uq_tiktok_posts_active_creator_content
  ON public.tiktok_posts(creator_content_id)
  WHERE creator_content_id IS NOT NULL
    AND status IN ('pending', 'uploading', 'processing');
