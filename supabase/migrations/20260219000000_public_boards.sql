-- Add is_public flag to boards
ALTER TABLE boards ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;

-- Drop existing boards SELECT policy and replace with one that allows any
-- authenticated user to see public boards
DROP POLICY IF EXISTS boards_select ON boards;
CREATE POLICY boards_select ON boards FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    is_public = true
    OR EXISTS (
      SELECT 1 FROM board_members
      WHERE board_id = boards.id AND user_id = auth.uid()
    )
  )
);

-- Allow any authenticated user to update visibility when they own the board
DROP POLICY IF EXISTS boards_update ON boards;
CREATE POLICY boards_update ON boards FOR UPDATE USING (
  auth.uid() IS NOT NULL AND (
    auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM board_members
      WHERE board_id = boards.id AND user_id = auth.uid()
    )
  )
);

-- Documents: allow access when board is public (any authenticated user)
DROP POLICY IF EXISTS documents_all ON documents;
CREATE POLICY documents_all ON documents FOR ALL USING (
  auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM boards
    WHERE id = documents.board_id AND (
      is_public = true
      OR EXISTS (
        SELECT 1 FROM board_members
        WHERE board_id = documents.board_id AND user_id = auth.uid()
      )
    )
  )
);

-- Locks: update select + write policies for public boards
DROP POLICY IF EXISTS locks_select ON locks;
CREATE POLICY locks_select ON locks FOR SELECT USING (
  auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM boards
    WHERE id = locks.board_id AND (
      is_public = true
      OR EXISTS (
        SELECT 1 FROM board_members
        WHERE board_id = locks.board_id AND user_id = auth.uid()
      )
    )
  )
);

DROP POLICY IF EXISTS locks_insert ON locks;
CREATE POLICY locks_insert ON locks FOR INSERT WITH CHECK (
  auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM boards
    WHERE id = locks.board_id AND (
      is_public = true
      OR EXISTS (
        SELECT 1 FROM board_members
        WHERE board_id = locks.board_id AND user_id = auth.uid()
      )
    )
  )
);

-- Presence: update select + write policies for public boards
DROP POLICY IF EXISTS presence_select ON presence;
CREATE POLICY presence_select ON presence FOR SELECT USING (
  auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM boards
    WHERE id = presence.board_id AND (
      is_public = true
      OR EXISTS (
        SELECT 1 FROM board_members
        WHERE board_id = presence.board_id AND user_id = auth.uid()
      )
    )
  )
);

DROP POLICY IF EXISTS presence_insert ON presence;
CREATE POLICY presence_insert ON presence FOR INSERT WITH CHECK (
  auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM boards
    WHERE id = presence.board_id AND (
      is_public = true
      OR EXISTS (
        SELECT 1 FROM board_members
        WHERE board_id = presence.board_id AND user_id = auth.uid()
      )
    )
  )
);

-- board_members: allow any authenticated user to self-join a public board
DROP POLICY IF EXISTS board_members_insert ON board_members;
CREATE POLICY board_members_insert ON board_members FOR INSERT WITH CHECK (
  auth.uid() = user_id AND (
    EXISTS (SELECT 1 FROM boards WHERE id = board_id AND is_public = true)
    OR EXISTS (SELECT 1 FROM boards WHERE id = board_id AND owner_id IS NOT NULL)
  )
);
