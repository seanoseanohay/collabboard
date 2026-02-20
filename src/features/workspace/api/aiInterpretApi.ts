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
      return { commands: [{ action: 'applyTemplate', templateId }], source: 'template' }
    }
  }
  return null
}

/** Named CSS colors → hex values used by the canvas. */
const COLOR_MAP: Record<string, string> = {
  blue: '#3b82f6',
  red: '#ef4444',
  green: '#10b981',
  yellow: '#fef08a',
  purple: '#8b5cf6',
  orange: '#f97316',
  pink: '#ec4899',
  black: '#000000',
  white: '#ffffff',
  gray: '#9ca3af',
  grey: '#9ca3af',
  teal: '#14b8a6',
  cyan: '#06b6d4',
  indigo: '#6366f1',
}

/** Natural-language shape names → canvas type values. */
const SHAPE_MAP: Record<string, string> = {
  circle: 'circle',
  oval: 'circle',
  ellipse: 'circle',
  square: 'rect',
  rect: 'rect',
  rectangle: 'rect',
  box: 'rect',
  triangle: 'triangle',
  line: 'line',
  text: 'text',
  label: 'text',
  sticky: 'sticky',
  note: 'sticky',
  'sticky note': 'sticky',
}

const COLOR_NAMES = Object.keys(COLOR_MAP).join('|')
const SHAPE_NAMES = 'circle|oval|ellipse|square|rect|rectangle|box|triangle|line|text|label|sticky|sticky\\s+note|note'
const SIMPLE_SHAPE_RE = new RegExp(
  `^(?:draw|add|create|make)\\s+(?:a\\s+|an\\s+)?` +
  `(?:(${COLOR_NAMES})\\s+)?` +
  `(${SHAPE_NAMES})` +
  `(?:\\s+at\\s+(-?\\d+)\\s*,?\\s*(-?\\d+))?` +
  `\\.?$`,
  'i'
)

/**
 * Detects simple single-object creation prompts ("draw a blue circle at 100, 100") and
 * returns a response instantly without calling the Edge Function or OpenAI.
 * Only matches unambiguous, single-object, single-color patterns.
 */
function detectSimpleShape(prompt: string): AiInterpretResponse | null {
  const match = prompt.trim().match(SIMPLE_SHAPE_RE)
  if (!match) return null

  const colorName = match[1]?.toLowerCase()
  const shapeName = match[2]?.toLowerCase().replace(/\s+/, ' ')
  const x = match[3] !== undefined ? parseInt(match[3]) : undefined
  const y = match[4] !== undefined ? parseInt(match[4]) : undefined

  const type = SHAPE_MAP[shapeName]
  if (!type) return null

  const props: Record<string, unknown> = {}
  if (colorName) props.fill = COLOR_MAP[colorName]
  if (x !== undefined) props.left = x
  if (y !== undefined) props.top = y

  return { commands: [{ action: 'createObject', type, props }], source: 'local' }
}

export interface AiUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

export interface AiInterpretResponse {
  commands: AiCommand[]
  /**
   * 'local'    = single-shape pattern matched client-side, zero network cost.
   * 'template' = known template matched client-side, zero network cost.
   * 'api'      = called Edge Function + OpenAI.
   */
  source?: 'local' | 'template' | 'api'
  usage?: AiUsage
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

  const simple = detectSimpleShape(prompt)
  if (simple) return simple

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

  return { commands: data.commands, source: 'api', usage: data.usage }
}
