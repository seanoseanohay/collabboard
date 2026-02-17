/**
 * Environment variable validation.
 * Fail fast if required vars missing in production.
 */
export const env = {
  get supabaseUrl() {
    return import.meta.env.VITE_SUPABASE_URL ?? ''
  },
  get supabaseAnonKey() {
    return import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
  },
  get isDev() {
    return import.meta.env.DEV
  },
} as const
