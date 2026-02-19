-- Ensure the board-thumbnails bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('board-thumbnails', 'board-thumbnails', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing policies if any, then recreate
DROP POLICY IF EXISTS "thumbnails_insert" ON storage.objects;
DROP POLICY IF EXISTS "thumbnails_update" ON storage.objects;
DROP POLICY IF EXISTS "thumbnails_select" ON storage.objects;

-- Allow any authenticated user to upload thumbnails
CREATE POLICY "thumbnails_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'board-thumbnails');

-- Allow any authenticated user to overwrite (upsert) thumbnails
CREATE POLICY "thumbnails_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'board-thumbnails');

-- Allow anyone to read thumbnails (public bucket)
CREATE POLICY "thumbnails_select"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'board-thumbnails');
