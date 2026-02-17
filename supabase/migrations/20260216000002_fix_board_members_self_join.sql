-- Fix 403 when joining board via share link: board_members_insert used EXISTS (SELECT FROM boards)
-- which is subject to RLS. Non-members can't see boards, so the check failed.
-- Use SECURITY DEFINER to check board exists without RLS.

CREATE OR REPLACE FUNCTION public.board_exists(p_board_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $func$
  SELECT EXISTS (SELECT 1 FROM public.boards WHERE id = p_board_id AND owner_id IS NOT NULL);
$func$;

DROP POLICY IF EXISTS board_members_insert ON board_members;
CREATE POLICY board_members_insert ON board_members FOR INSERT WITH CHECK (
  auth.uid() = user_id AND board_exists(board_id)
);
