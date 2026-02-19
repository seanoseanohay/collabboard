-- Add thumbnail URL to boards table
ALTER TABLE boards ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- Storage bucket for board thumbnails (run via Supabase dashboard or Storage API)
-- NOTE: Create a public bucket named 'board-thumbnails' in Supabase Storage.
-- The bucket must be PUBLIC so thumbnail URLs are accessible without auth.
-- Dashboard: Storage > New bucket > Name: board-thumbnails > Public: ON

-- Allow board members and public board viewers to read/write thumbnails
-- (Handled via Storage policies on the bucket, not SQL RLS)
-- Policy to set on the bucket via dashboard or Storage API:
--   SELECT: true (public bucket)
--   INSERT/UPDATE: auth.uid() IS NOT NULL
