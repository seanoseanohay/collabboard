import { getSupabaseClient } from '@/shared/lib/supabase/config'

export async function signInWithGoogle(): Promise<void> {
  const supabase = getSupabaseClient()
  const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/` : undefined
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  })
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signUpWithEmail(
  email: string,
  password: string
): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
}

export async function signOutUser(): Promise<void> {
  const supabase = getSupabaseClient()
  await supabase.auth.signOut()
}

export function getAuthErrorMessage(err: { message?: string; code?: string }): string {
  const msg = err.message ?? ''
  if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials')) {
    return 'Invalid email or password.'
  }
  if (msg.includes('already registered') || msg.includes('already been registered')) {
    return 'This email is already registered.'
  }
  if (msg.includes('Password')) {
    return 'Password must be at least 6 characters.'
  }
  if (msg.includes('cancel') || msg.includes('popup')) {
    return 'Sign-in was cancelled.'
  }
  return msg || 'An error occurred.'
}
