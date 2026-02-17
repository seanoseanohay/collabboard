/**
 * Run RLS fix migrations against Supabase.
 * Requires SUPABASE_DB_URL (from Dashboard > Settings > Database > Connection string URI).
 * Usage: SUPABASE_DB_URL="postgresql://..." npm run db:migrate
 *
 * Runs: 00001 (recursion fix), 00002 (board_members self-join fix).
 * Initial schema (00000) is run separately in SQL Editor.
 */
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationsDir = join(__dirname, '../supabase/migrations')
const FIX_MIGRATIONS = [
  '20260216000001_fix_board_members_rls_recursion.sql',
  '20260216000002_fix_board_members_self_join.sql',
]

async function main() {
  let dbUrl = process.env.SUPABASE_DB_URL
  if (!dbUrl) {
    try {
      const envPath = join(process.cwd(), '.env.local')
      const env = readFileSync(envPath, 'utf8')
      const match = env.match(/SUPABASE_DB_URL=(.+)/m)
      if (match) dbUrl = match[1].replace(/^["']|["']$/g, '').trim()
    } catch {
      /* ignore */
    }
  }
  if (!dbUrl) {
    console.error('Set SUPABASE_DB_URL in .env.local or environment.')
    console.error('Get it from Supabase Dashboard > Settings > Database > Connection string (URI)')
    process.exit(1)
  }

  const client = new pg.Client({ connectionString: dbUrl })
  try {
    await client.connect()
    for (const file of FIX_MIGRATIONS) {
      const sql = readFileSync(join(migrationsDir, file), 'utf8')
      await client.query(sql)
      console.log(`Applied: ${file}`)
    }
    console.log('All migrations applied successfully.')
  } catch (err) {
    console.error('Migration failed:', err.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()
