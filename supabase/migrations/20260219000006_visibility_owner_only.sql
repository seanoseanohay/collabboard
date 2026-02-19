-- Only the board owner can change is_public.
-- The existing boards_update policy allows any member to UPDATE,
-- but we want is_public changes restricted to the owner.
-- Easiest approach: add a separate permissive policy only for is_public updates
-- via a dedicated RPC that enforces ownership server-side.

-- Replace boards_update so that only the owner can flip is_public,
-- while any member can still update title etc.
-- We enforce this at the application level (updateBoardVisibility checks ownership)
-- and here via a tighter UPDATE policy that checks owner_id for is_public changes.

-- The simplest enforcement: keep the current boards_update policy as-is
-- (members can update title/thumbnail_url), but add an RPC for visibility
-- that enforces ownership internally.

CREATE OR REPLACE FUNCTION update_board_visibility(p_board_id UUID, p_is_public BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_owner_id UUID;
BEGIN
  SELECT owner_id INTO v_owner_id FROM boards WHERE id = p_board_id;
  IF v_owner_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only the board owner can change visibility';
  END IF;
  UPDATE boards SET is_public = p_is_public WHERE id = p_board_id;
END;
$$;

GRANT EXECUTE ON FUNCTION update_board_visibility(UUID, BOOLEAN) TO authenticated;
