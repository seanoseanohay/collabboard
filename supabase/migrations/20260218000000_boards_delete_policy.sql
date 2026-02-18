-- Allow board owner to delete their board (cascades to board_members, user_boards, documents, locks, presence)
CREATE POLICY boards_delete ON boards FOR DELETE USING (auth.uid() = owner_id);
