import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Schema types added when DB is provisioned
let client: SupabaseClient<any> | null = null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSupabaseClient(): SupabaseClient<any> {
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      realtime: { timeout: 20000 },
    })
  }
  return client
}
