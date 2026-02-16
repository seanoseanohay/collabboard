import { useEffect, useState } from 'react'
import { type User, onAuthStateChanged } from 'firebase/auth'
import { getAuthInstance } from '@/shared/lib/firebase/config'

export interface AuthState {
  user: User | null
  loading: boolean
  error: string | null
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const auth = getAuthInstance()
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
      setError(null)
    })
    return () => unsubscribe()
  }, [])

  return { user, loading, error }
}
