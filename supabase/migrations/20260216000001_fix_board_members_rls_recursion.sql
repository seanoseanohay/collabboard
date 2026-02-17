-- Fix infinite recursion in board_members RLS policy.
-- The board_members_select policy queried board_members to check membership,
-- which re-triggered the same policy. Use a SECURITY DEFINER function instead.

CREATE OR REPLACE FUNCTION public.is_board_member(p_board_id UUID, p_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $func$
  SELECT EXISTS (
    SELECT 1 FROM public.board_members
    WHERE board_id = p_board_id AND user_id = COALESCE(p_user_id, auth.uid())
  );
$func$;

-- Replace recursive policy with function-based check
DROP POLICY IF EXISTS board_members_select ON board_members;
CREATE POLICY board_members_select ON board_members FOR SELECT USING (
  auth.uid() = user_id OR is_board_member(board_id)
);

-- Boards SELECT: allow owner OR member (owner needs SELECT for INSERT...RETURNING to work
-- before board_members row exists)
DROP POLICY IF EXISTS boards_select ON boards;
CREATE POLICY boards_select ON boards FOR SELECT USING (
  auth.uid() = owner_id OR is_board_member(id)
);

DROP POLICY IF EXISTS boards_update ON boards;
CREATE POLICY boards_update ON boards FOR UPDATE USING (
  auth.uid() = owner_id OR is_board_member(id)
);
