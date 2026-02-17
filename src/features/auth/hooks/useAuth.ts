import { useEffect, useState } from 'react'
import { getSupabaseClient } from '@/shared/lib/supabase/config'

/** Normalized user shape for app compatibility (maps Supabase User). */
export interface AuthUser {
  uid: string
  email: string | null
  displayName: string | null
}

export interface AuthState {
  user: AuthUser | null
  loading: boolean
  error: string | null
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = getSupabaseClient()

    const mapUser = (u: { id: string; email?: string; user_metadata?: { full_name?: string } } | null) => {
      if (!u) return null
      return {
        uid: u.id,
        email: u.email ?? null,
        displayName: (u.user_metadata?.full_name as string) ?? u.email ?? null,
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      setUser(mapUser(data.session?.user ?? null))
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(mapUser(session?.user ?? null))
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  return { user, loading, error: null }
}
