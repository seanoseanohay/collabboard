/**
 * AI Interpret API — invoke the ai-interpret Edge Function.
 * Sends natural language prompt, receives structured commands for the client to execute.
 *
 * Performance: known template prompts are detected client-side and bypass the Edge
 * Function entirely (saves cold-start + 3 DB round-trips + OpenAI latency).
 */

import { getSupabaseClient } from '@/shared/lib/supabase/config'

const FUNCTION_NAME = 'ai-interpret'

// Mirrors the template trigger phrases in the Edge Function system prompt.
const TEMPLATE_PATTERNS: Array<{ pattern: RegExp; templateId: string }> = [
  { pattern: /pros.{0,5}cons|pros\s+and\s+cons/i, templateId: 'pros-cons' },
  { pattern: /\bswot\b|4[- ]quadrant/i, templateId: 'swot' },
  { pattern: /user.{0,5}journey|journey\s+map/i, templateId: 'user-journey' },
  { pattern: /\bretrospective\b|\bretro\b|what\s+went\s+well/i, templateId: 'retrospective' },
]

/** Returns a local applyTemplate response when the prompt clearly maps to a known template. */
function detectTemplateLocally(prompt: string): AiInterpretResponse | null {
  for (const { pattern, templateId } of TEMPLATE_PATTERNS) {
    if (pattern.test(prompt)) {
      return { commands: [{ action: 'applyTemplate', templateId }] }
    }
  }
  return null
}

export interface AiInterpretResponse {
  commands: AiCommand[]
}

export type AiCommand =
  | { action: 'createObject'; type: string; props: Record<string, unknown> }
  | { action: 'queryObjects'; criteria?: { type?: string; fill?: string }; storeAs?: string }
  | { action: 'deleteObjects'; objectIds?: string[]; objectIdsFromPreviousQuery?: boolean }
  | { action: 'updateObject'; objectId: string; partialProps: Record<string, unknown> }
  | { action: 'arrangeInGrid'; objectIds: string[]; cols?: number }
  | { action: 'spaceEvenly'; objectIds: string[]; direction?: 'horizontal' | 'vertical' }
  | { action: 'createFrame'; title?: string }
  | { action: 'groupCreated' }
  | { action: 'applyTemplate'; templateId: string }

export interface AiInterpretOptions {
  selectedObjectIds?: string[]
  viewportCenter?: { x: number; y: number }
}

export async function invokeAiInterpret(
  boardId: string,
  prompt: string,
  options?: AiInterpretOptions
): Promise<AiInterpretResponse> {
  const local = detectTemplateLocally(prompt)
  if (local) return local

  const supabase = getSupabaseClient()

  const { data, error } = await supabase.functions.invoke<AiInterpretResponse & { error?: string }>(
    FUNCTION_NAME,
    { body: { boardId, prompt, selectedObjectIds: options?.selectedObjectIds, viewportCenter: options?.viewportCenter } }
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
