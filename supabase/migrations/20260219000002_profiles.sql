-- Profiles: public display names per user, populated on first sign-in
CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read profiles (needed to show member names in share modal)
CREATE POLICY profiles_select ON profiles FOR SELECT USING (auth.uid() IS NOT NULL);

-- Users can only write their own profile
CREATE POLICY profiles_insert ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY profiles_update ON profiles FOR UPDATE USING (auth.uid() = user_id);

-- Trigger to auto-create a profile when a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- RPC: get members of a board with their display names
CREATE OR REPLACE FUNCTION get_board_members(p_board_id UUID)
RETURNS TABLE(
  user_id UUID,
  display_name TEXT,
  email TEXT,
  is_owner BOOLEAN,
  joined_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    bm.user_id,
    COALESCE(p.display_name, split_part(p.email, '@', 1), 'Unknown') AS display_name,
    p.email,
    (b.owner_id = bm.user_id) AS is_owner,
    bm.joined_at
  FROM board_members bm
  LEFT JOIN profiles p ON p.user_id = bm.user_id
  LEFT JOIN boards b ON b.id = bm.board_id
  WHERE bm.board_id = p_board_id
    AND (
      b.is_public = true
      OR EXISTS (
        SELECT 1 FROM board_members bm2
        WHERE bm2.board_id = p_board_id AND bm2.user_id = auth.uid()
      )
    )
  ORDER BY is_owner DESC, bm.joined_at ASC;
$$;

GRANT EXECUTE ON FUNCTION get_board_members(UUID) TO authenticated;

-- RPC: remove a member from a board (owner only)
CREATE OR REPLACE FUNCTION remove_board_member(p_board_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_owner_id UUID;
BEGIN
  SELECT owner_id INTO v_owner_id FROM boards WHERE id = p_board_id;
  IF v_owner_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only the board owner can remove members';
  END IF;
  IF p_user_id = v_owner_id THEN
    RAISE EXCEPTION 'Cannot remove the board owner';
  END IF;
  DELETE FROM board_members WHERE board_id = p_board_id AND user_id = p_user_id;
  DELETE FROM user_boards WHERE board_id = p_board_id AND user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION remove_board_member(UUID, UUID) TO authenticated;
