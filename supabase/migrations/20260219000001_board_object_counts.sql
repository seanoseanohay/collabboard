-- RPC: returns user boards with object counts and thumbnail URLs
CREATE OR REPLACE FUNCTION get_user_boards_with_counts(p_user_id UUID)
RETURNS TABLE(
  board_id UUID,
  title TEXT,
  created_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,
  is_public BOOLEAN,
  owner_id UUID,
  object_count BIGINT,
  thumbnail_url TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    ub.board_id,
    ub.title,
    ub.created_at,
    ub.last_accessed_at,
    COALESCE(b.is_public, false) AS is_public,
    b.owner_id,
    COUNT(d.object_id) AS object_count,
    b.thumbnail_url
  FROM user_boards ub
  LEFT JOIN boards b ON b.id = ub.board_id
  LEFT JOIN documents d ON d.board_id = ub.board_id
  WHERE ub.user_id = p_user_id
  GROUP BY ub.board_id, ub.title, ub.created_at, ub.last_accessed_at, b.is_public, b.owner_id, b.thumbnail_url
  ORDER BY ub.last_accessed_at DESC NULLS LAST;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_user_boards_with_counts(UUID) TO authenticated;
