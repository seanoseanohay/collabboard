/**
 * AI Interpret API — invoke the ai-interpret Edge Function.
 * Sends natural language prompt, receives structured commands for the client to execute.
 */

import { getSupabaseClient } from '@/shared/lib/supabase/config'
import { env } from '@/shared/config/env'

const FUNCTION_NAME = 'ai-interpret'

export interface AiInterpretResponse {
  commands: AiCommand[]
}

export type AiCommand =
  | { action: 'createObject'; type: string; props: Record<string, unknown> }
  | { action: 'queryObjects'; criteria?: { type?: string; fill?: string }; storeAs?: string }
  | { action: 'deleteObjects'; objectIds?: string[]; objectIdsFromPreviousQuery?: boolean }
  | { action: 'updateObject'; objectId: string; partialProps: Record<string, unknown> }

export async function invokeAiInterpret(boardId: string, prompt: string): Promise<AiInterpretResponse> {
  const supabase = getSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('You must be signed in to use AI.')
  }

  const res = await fetch(`${env.supabaseUrl}/functions/v1/${FUNCTION_NAME}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: env.supabaseAnonKey,
    },
    body: JSON.stringify({ boardId, prompt }),
  })

  const data = (await res.json()) as AiInterpretResponse & { error?: string }
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Not authorized. Sign in again, or deploy: supabase functions deploy ai-interpret')
    }
    throw new Error(data?.error ?? `AI interpret failed (${res.status})`)
  }

  if (!Array.isArray(data.commands)) {
    throw new Error('Invalid AI response: missing commands array')
  }

  return data
}
