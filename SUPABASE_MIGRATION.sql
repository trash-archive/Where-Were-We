-- ═══════════════════════════════════════════════════════════════════════════
-- WHERE WERE WE — Migration (run this if you already have the base tables)
-- ═══════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────
-- 1. Add is_public column to photos
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.photos
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_photos_public
  ON public.photos (is_public, lat)
  WHERE is_public = true AND lat IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────────
-- 2. Fix the photos SELECT policy to also allow reading public photos
--    (your existing policy only lets users see their own photos)
-- ─────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own photos" ON public.photos;

CREATE POLICY "Users can view own or public photos"
  ON public.photos FOR SELECT
  USING (auth.uid() = user_id OR is_public = true);


-- ─────────────────────────────────────────────────────────────────────────
-- 3. Storage bucket policies for the "photos" bucket
--    (make sure you've already created the bucket manually in Storage tab)
-- ─────────────────────────────────────────────────────────────────────────

-- Users can upload only into their own folder (userId/filename)
CREATE POLICY "storage_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'photos'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Anyone can read photos (needed for public_url to work in <img> tags)
CREATE POLICY "storage_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'photos');

-- Users can delete only their own files
CREATE POLICY "storage_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'photos'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
