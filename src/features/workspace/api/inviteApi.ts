import { getSupabaseClient } from '@/shared/lib/supabase/config'
import { env } from '@/shared/config/env'

export type InviteMode = 'add' | 'email'

export async function inviteToBoard(
  boardId: string,
  email: string,
  mode: InviteMode
): Promise<{ added?: boolean; sent?: boolean; message: string }> {
  const supabase = getSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('You must be signed in to invite others.')
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : undefined
  const res = await fetch(`${env.supabaseUrl}/functions/v1/invite-to-board`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: env.supabaseAnonKey,
    },
    body: JSON.stringify({
      boardId,
      email: email.trim().toLowerCase(),
      mode,
      origin,
    }),
  })

  const data = (await res.json()) as { added?: boolean; sent?: boolean; message?: string; error?: string }
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error(
        'Not authorized. Sign in again, or deploy the function: supabase functions deploy invite-to-board'
      )
    }
    throw new Error(data?.error ?? `Invite failed (${res.status})`)
  }

  return {
    added: data?.added,
    sent: data?.sent,
    message: data?.message ?? 'Done',
  }
}
