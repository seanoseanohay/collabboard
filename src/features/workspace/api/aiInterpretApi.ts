/**
 * AI Interpret API — invoke the ai-interpret Edge Function.
 * Sends natural language prompt, receives structured commands for the client to execute.
 */

import { getSupabaseClient } from '@/shared/lib/supabase/config'

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

  const { data, error } = await supabase.functions.invoke<AiInterpretResponse & { error?: string }>(
    FUNCTION_NAME,
    { body: { boardId, prompt } }
  )

  if (error) {
    // FunctionsHttpError carries the HTTP status; extract message from body if possible
    const msg = (error as { message?: string; context?: { json?: () => Promise<{ error?: string }> } }).message ?? String(error)
    if (msg.includes('401') || msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('not authorized')) {
      throw new Error('Not authorized — make sure you are signed in and the function is deployed.')
    }
    throw new Error(msg)
  }

  if (!data || !Array.isArray(data.commands)) {
    throw new Error('Invalid AI response: missing commands array')
  }

  return data as AiInterpretResponse
}
