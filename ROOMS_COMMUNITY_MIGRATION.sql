-- Add include_community setting to rooms table
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS include_community BOOLEAN NOT NULL DEFAULT false;
