import { useEffect, useRef, useState } from 'react'
import { type User, onAuthStateChanged } from 'firebase/auth'
import { getAuthInstance } from '@/shared/lib/firebase/config'

const AUTH_NULL_DEBOUNCE_MS = 1500

export interface AuthState {
  user: User | null
  loading: boolean
  error: string | null
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const userRef = useRef<User | null>(null)

  useEffect(() => {
    const auth = getAuthInstance()
    let pendingNullTimer: ReturnType<typeof setTimeout> | null = null

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u !== null) {
        if (pendingNullTimer) {
          clearTimeout(pendingNullTimer)
          pendingNullTimer = null
        }
        userRef.current = u
        setUser(u)
        setLoading(false)
        setError(null)
      } else {
        if (userRef.current !== null) {
          if (pendingNullTimer) clearTimeout(pendingNullTimer)
          pendingNullTimer = setTimeout(() => {
            pendingNullTimer = null
            userRef.current = null
            setUser(null)
          }, AUTH_NULL_DEBOUNCE_MS)
        } else {
          setUser(null)
          setLoading(false)
        }
      }
    })

    return () => {
      if (pendingNullTimer) clearTimeout(pendingNullTimer)
      unsubscribe()
    }
  }, [])

  return { user, loading, error }
}
