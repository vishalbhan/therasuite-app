-- Add holidays column to profiles table (array of date strings)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS holidays JSONB DEFAULT '[]'::jsonb;
