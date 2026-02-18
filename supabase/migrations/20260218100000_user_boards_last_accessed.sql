-- Add last_accessed_at to user_boards for "recently opened" ordering
-- Default to created_at so existing boards sort sensibly
ALTER TABLE user_boards
  ADD COLUMN last_accessed_at TIMESTAMPTZ;

UPDATE user_boards
SET last_accessed_at = created_at
WHERE last_accessed_at IS NULL;

ALTER TABLE user_boards
  ALTER COLUMN last_accessed_at SET NOT NULL,
  ALTER COLUMN last_accessed_at SET DEFAULT now();
