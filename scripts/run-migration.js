/**
 * Run RLS fix migration against Supabase.
 * Requires SUPABASE_DB_URL (from Dashboard > Settings > Database > Connection string URI).
 * Usage: SUPABASE_DB_URL="postgresql://..." npm run db:migrate
 */
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))

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

  const sql = readFileSync(
    join(__dirname, '../supabase/migrations/20260216000001_fix_board_members_rls_recursion.sql'),
    'utf8'
  )

  const client = new pg.Client({ connectionString: dbUrl })
  try {
    await client.connect()
    await client.query(sql)
    console.log('Migration applied successfully.')
  } catch (err) {
    console.error('Migration failed:', err.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()
