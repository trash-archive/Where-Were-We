-- ═══════════════════════════════════════════════════════════════════════════
-- WHERE WERE WE — Photo Reports Migration
-- Run this in your Supabase SQL editor
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.photo_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id    UUID NOT NULL REFERENCES public.photos(id) ON DELETE CASCADE,
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason      TEXT NOT NULL CHECK (reason IN ('explicit', 'violence', 'hate', 'spam', 'other')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for looking up reports by photo
CREATE INDEX IF NOT EXISTS idx_photo_reports_photo_id ON public.photo_reports (photo_id);

-- Enable RLS
ALTER TABLE public.photo_reports ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert reports
CREATE POLICY "Authenticated users can report photos"
  ON public.photo_reports FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Only service role (admin) can read reports
CREATE POLICY "Only admins can view reports"
  ON public.photo_reports FOR SELECT
  USING (auth.role() = 'service_role');
