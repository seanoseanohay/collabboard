-- Fix: board owner can always SELECT their own board.
-- Without this, INSERT INTO boards ... RETURNING id fails with 403 because
-- at the moment of INSERT the user has no board_members row yet, so the
-- existing SELECT policy (which checks board_members) rejects the RETURNING.
DROP POLICY IF EXISTS boards_select ON boards;
CREATE POLICY boards_select ON boards FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    is_public = true
    OR auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM board_members
      WHERE board_id = boards.id AND user_id = auth.uid()
    )
  )
);
