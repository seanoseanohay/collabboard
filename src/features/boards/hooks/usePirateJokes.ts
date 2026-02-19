/**
 * usePirateJokes — fetches 5 AI-generated pirate jokes/day from the pirate-jokes Edge Function.
 * Caches results in localStorage keyed by date (meboard:jokes:YYYY-MM-DD).
 * Falls back to hardcoded jokes if the fetch fails or the function is unavailable.
 * Exposes a stable pickJoke() function and a loading flag.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { getSupabaseClient } from '@/shared/lib/supabase/config'

const FALLBACK_JOKES: string[] = [
  "Ahoy, Captain! Ready to plunder some brilliant ideas today?",
  "Squawk! Welcome back to yer treasure map canvas, Captain!",
  "Why did the pirate go to art school? To improve his ARRRRT! 🎨",
  "A pirate's favorite letter? Ye think it be R, but it be the C! 🌊",
  "What's a pirate's favorite social network? Instagramarrr!",
  "Batten down the hatches — great ideas are ahead, Captain!",
  "Blimey! Your boards await. Which treasure shall we chart today?",
  "Why do pirates make great designers? They always think outside the BOAX! 📦",
]

const CACHE_KEY_PREFIX = 'meboard:jokes:'

function getTodayKey(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${CACHE_KEY_PREFIX}${yyyy}-${mm}-${dd}`
}

function loadCached(): string[] | null {
  try {
    const raw = localStorage.getItem(getTodayKey())
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((j) => typeof j === 'string')) {
      return parsed as string[]
    }
  } catch {
    // corrupt cache — ignore
  }
  return null
}

export function usePirateJokes(): { pickJoke: () => string; loading: boolean } {
  const jokesRef = useRef<string[]>(FALLBACK_JOKES)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const cached = loadCached()
    if (cached) {
      jokesRef.current = cached
      setLoading(false)
      return
    }

    const supabase = getSupabaseClient()
    supabase.functions
      .invoke<{ jokes?: string[]; error?: string }>('pirate-jokes')
      .then(({ data, error }) => {
        if (!error && Array.isArray(data?.jokes) && data.jokes.length > 0) {
          jokesRef.current = data.jokes
          try {
            localStorage.setItem(getTodayKey(), JSON.stringify(data.jokes))
          } catch {
            // storage full — skip caching
          }
        }
        // fallback already set; nothing to do on error
      })
      .catch(() => {
        // network error — jokesRef stays as FALLBACK_JOKES
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const pickJoke = useCallback((): string => {
    const arr = jokesRef.current
    return arr[Math.floor(Math.random() * arr.length)]
  }, [])

  return { pickJoke, loading }
}
