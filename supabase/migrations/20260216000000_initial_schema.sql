-- CollabBoard initial schema for Supabase
-- Run in Supabase SQL Editor or via: supabase db push

-- Boards
CREATE TABLE boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT 'Untitled Board',
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Board membership
CREATE TABLE board_members (
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (board_id, user_id)
);

-- User boards denormalization (for board list)
CREATE TABLE user_boards (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, board_id)
);

-- Documents (Fabric object sync)
CREATE TABLE documents (
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  object_id UUID NOT NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (board_id, object_id)
);

-- Locks
CREATE TABLE locks (
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  object_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT,
  last_active BIGINT DEFAULT (extract(epoch from now()) * 1000)::bigint,
  PRIMARY KEY (board_id, object_id)
);

-- Presence (cursors)
CREATE TABLE presence (
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  x DOUBLE PRECISION DEFAULT 0,
  y DOUBLE PRECISION DEFAULT 0,
  name TEXT,
  color TEXT DEFAULT '#6366f1',
  last_active BIGINT DEFAULT (extract(epoch from now()) * 1000)::bigint,
  PRIMARY KEY (board_id, user_id)
);

-- Enable RLS
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE presence ENABLE ROW LEVEL SECURITY;

-- Boards: read/write if member
CREATE POLICY boards_select ON boards FOR SELECT USING (
  EXISTS (SELECT 1 FROM board_members WHERE board_id = boards.id AND user_id = auth.uid())
);
CREATE POLICY boards_insert ON boards FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY boards_update ON boards FOR UPDATE USING (
  EXISTS (SELECT 1 FROM board_members WHERE board_id = boards.id AND user_id = auth.uid())
);

-- Board members: self-join when board exists
CREATE POLICY board_members_select ON board_members FOR SELECT USING (
  EXISTS (SELECT 1 FROM board_members bm WHERE bm.board_id = board_members.board_id AND bm.user_id = auth.uid())
);
CREATE POLICY board_members_insert ON board_members FOR INSERT WITH CHECK (
  auth.uid() = user_id AND EXISTS (SELECT 1 FROM boards WHERE id = board_id AND owner_id IS NOT NULL)
);

-- User boards: own data only
CREATE POLICY user_boards_all ON user_boards FOR ALL USING (auth.uid() = user_id);

-- Documents: member read/write
CREATE POLICY documents_all ON documents FOR ALL USING (
  EXISTS (SELECT 1 FROM board_members WHERE board_id = documents.board_id AND user_id = auth.uid())
);

-- Locks: member read, own write
CREATE POLICY locks_select ON locks FOR SELECT USING (
  EXISTS (SELECT 1 FROM board_members WHERE board_id = locks.board_id AND user_id = auth.uid())
);
CREATE POLICY locks_insert ON locks FOR INSERT WITH CHECK (
  auth.uid() = user_id AND EXISTS (SELECT 1 FROM board_members WHERE board_id = locks.board_id AND user_id = auth.uid())
);
CREATE POLICY locks_update ON locks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY locks_delete ON locks FOR DELETE USING (auth.uid() = user_id);

-- Presence: member read, own write
CREATE POLICY presence_select ON presence FOR SELECT USING (
  EXISTS (SELECT 1 FROM board_members WHERE board_id = presence.board_id AND user_id = auth.uid())
);
CREATE POLICY presence_insert ON presence FOR INSERT WITH CHECK (
  auth.uid() = user_id AND EXISTS (SELECT 1 FROM board_members WHERE board_id = presence.board_id AND user_id = auth.uid())
);
CREATE POLICY presence_update ON presence FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY presence_delete ON presence FOR DELETE USING (auth.uid() = user_id);

-- Enable Realtime: In Supabase Dashboard, go to Database > Replication
-- and add documents, locks, presence to the supabase_realtime publication.
