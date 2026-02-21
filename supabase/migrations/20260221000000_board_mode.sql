-- Add board_mode to boards table (standard whiteboard vs explorer map)
ALTER TABLE boards ADD COLUMN IF NOT EXISTS board_mode TEXT NOT NULL DEFAULT 'standard';

-- Must DROP first because return type is changing (adding board_mode column)
DROP FUNCTION IF EXISTS get_user_boards_with_counts(UUID);

CREATE FUNCTION get_user_boards_with_counts(p_user_id UUID)
RETURNS TABLE(
  board_id UUID,
  title TEXT,
  created_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,
  is_public BOOLEAN,
  owner_id UUID,
  thumbnail_url TEXT,
  board_mode TEXT,
  object_count BIGINT
) LANGUAGE sql STABLE AS $$
  SELECT
    b.id        AS board_id,
    b.title,
    b.created_at,
    ub.last_accessed_at,
    b.is_public,
    b.owner_id,
    b.thumbnail_url,
    b.board_mode,
    COUNT(d.object_id) AS object_count
  FROM user_boards ub
  JOIN boards b ON b.id = ub.board_id
  LEFT JOIN documents d ON d.board_id = b.id
  WHERE ub.user_id = p_user_id
  GROUP BY b.id, ub.last_accessed_at
$$;
