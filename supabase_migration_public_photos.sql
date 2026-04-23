-- Migration: Add is_public flag to photos
-- Run this in Supabase Dashboard → SQL Editor

ALTER TABLE photos ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

-- Index for fast public photo queries
CREATE INDEX IF NOT EXISTS idx_photos_public ON photos (is_public, lat) WHERE is_public = true AND lat IS NOT NULL;

-- RLS: users can update is_public only on their own photos
-- (assumes you already have RLS enabled and a policy for SELECT/INSERT/DELETE)
-- Add this policy if it doesn't exist yet:
CREATE POLICY "Users can update own photos" ON photos
  FOR UPDATE USING (auth.uid() = user_id);

-- Allow anyone (authenticated) to read public photos
CREATE POLICY "Anyone can read public photos" ON photos
  FOR SELECT USING (is_public = true OR auth.uid() = user_id);
