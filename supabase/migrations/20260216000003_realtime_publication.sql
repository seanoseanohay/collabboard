-- Ensure documents, locks, presence are in supabase_realtime for postgres_changes.
-- Required for: object sync, cursors, locking.
-- Idempotent: skips tables already in the publication.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'documents') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE documents;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'locks') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE locks;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'presence') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE presence;
  END IF;
END $$;
