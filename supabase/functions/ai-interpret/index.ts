/**
 * AI Interpret — Supabase Edge Function for natural language → canvas commands.
 * Calls OpenAI Chat Completions, returns structured commands for the client to execute via aiClientApi.
 * Uses OPENAI_API_KEY secret. LangSmith tracing via LANGSMITH_TRACING + LANGSMITH_API_KEY.
 * Caller must be signed in and a board member.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import OpenAI from 'npm:openai@4'
import { wrapOpenAI } from 'npm:langsmith/wrappers/openai'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Core system prompt (~750 tokens). Sent for all requests.
 * Form-specific layout rules are appended separately only when the prompt mentions a form.
 */
const SYSTEM_PROMPT_CORE = `You are a canvas assistant for MeBoard. Respond with JSON: { "commands": [...] }.

createObject — draw X / add Y / create Z:
{ "action": "createObject", "type": "rect"|"circle"|"triangle"|"line"|"text"|"sticky"|"input-field"|"button", "props": { "left": number, "top": number, "width"?: number, "height"?: number, "fill"?: string, "stroke"?: string, "strokeWeight"?: number, "text"?: string, "fontSize"?: number } }
- left/top: pixels. Use viewport center if provided, else default 100,100.
- fill: hex. blue=#3b82f6 red=#ef4444 green=#10b981 yellow=#fef08a purple=#8b5cf6
- input-field: white input box, placeholder in text. Default 280×40.
- button: colored button, label in text. Default fill #3b82f6, size 280×44.

OTHER:
{ "action": "queryObjects", "criteria"?: { "type"?: string, "fill"?: string }, "storeAs"?: string }
{ "action": "deleteObjects", "objectIds"?: string[], "objectIdsFromPreviousQuery"?: boolean }
{ "action": "updateObject", "objectId": string, "partialProps": {...} }

LAYOUT (rearrange existing objects):
{ "action": "arrangeInGrid", "objectIds": string[], "cols": number }
{ "action": "spaceEvenly", "objectIds": string[], "direction": "horizontal"|"vertical" }
- "2 columns"→cols:2, "2 rows"→cols:ceil(N/2), "in a row"→spaceEvenly horizontal, "in a column"→spaceEvenly vertical

SELECTION: "these"/"them"/"selected" = selectedObjectIds provided in request.

TEMPLATES — return ONE command; client handles layout:
{ "action": "applyTemplate", "templateId": "swot"|"pros-cons"|"user-journey"|"retrospective"|"login-form"|"signup-form"|"contact-form" }
- pros/cons → pros-cons | SWOT/4-quadrant → swot | user journey/journey map → user-journey
- retrospective/retro/what went well → retrospective
- login/sign-in form → login-form | signup/register form → signup-form | contact form → contact-form

Return only valid JSON. No markdown.`

/**
 * Appended only when the prompt mentions a custom form (not matching a known template).
 * ~350 tokens. Skipping this for non-form prompts saves ~0.5s of TTFT.
 */
const FORM_ADDENDUM = `

DYNAMIC FORM GENERATION — for custom forms not matching known templates (e.g. "checkout form with card number, expiry, cvv"):
Generate createObject commands for each element, then end with createFrame.

Layout (VX=viewportCenter.x, VY=viewportCenter.y):
1. Title: type=text, left=VX-140, top=VY-200, width=280, height=28, fontSize=20, fill="#1e293b"
2. Per field: Label (type=text, height=20, fontSize=12, fill="#64748b") then Input (type=input-field, height=40; height=80 for textarea)
   - label_top[i+1] = input_bottom[i] + 16
3. Submit: type=button, width=280, height=44, fill="#3b82f6"; top = last_input_bottom + 24
4. End: { "action": "createFrame", "title": "Form Title" }`

/** Returns true when the prompt is likely asking for a custom form (not a known template). */
function isFormRequest(prompt: string): boolean {
  return /\bform\b|\bfields?\b|\binput\b|\bcheckout\b|\bwizard\b/i.test(prompt)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY not set. Add it in Supabase: Project Settings → Edge Functions → Secrets.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const body = (await req.json()) as { boardId?: string; prompt?: string; selectedObjectIds?: string[]; viewportCenter?: { x: number; y: number } }
    const { boardId, prompt, selectedObjectIds, viewportCenter } = body
    if (!boardId || typeof boardId !== 'string') {
      return new Response(JSON.stringify({ error: 'boardId is required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!prompt || typeof prompt !== 'string') {
      return new Response(JSON.stringify({ error: 'prompt is required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parallelize auth check and board existence check — saves one full DB round-trip.
    // Must pass token explicitly — Edge Functions have no session storage.
    const [{ data: { user } }, { data: board }] = await Promise.all([
      supabase.auth.getUser(token),
      supabase.from('boards').select('id').eq('id', boardId).single(),
    ])

    if (!user) {
      return new Response(JSON.stringify({ error: 'Must be signed in.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!board) {
      return new Response(JSON.stringify({ error: 'Board not found.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: members } = await supabase.from('board_members').select('user_id').eq('board_id', boardId)
    const isMember = members?.some((m: { user_id: string }) => m.user_id === user.id)
    if (!isMember) {
      return new Response(JSON.stringify({ error: 'Must be a board member to use AI on this board.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const systemPrompt = SYSTEM_PROMPT_CORE + (isFormRequest(prompt) ? FORM_ADDENDUM : '')
    console.log('[ai-interpret] request', { boardId, userId: user.id, promptPreview: prompt.slice(0, 100), includesFormAddendum: isFormRequest(prompt) })

    const openai = wrapOpenAI(new OpenAI({ apiKey }))
    const completion = await openai.chat.completions.create(
      {
        model: 'gpt-4o-mini',
        max_tokens: 300,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: (() => {
              let msg = prompt
              if (selectedObjectIds && selectedObjectIds.length > 0) {
                msg += `\n\nSelectedObjectIds: ${JSON.stringify(selectedObjectIds)}`
              }
              if (viewportCenter) {
                msg += `\n\nUser viewport center: x=${Math.round(viewportCenter.x)}, y=${Math.round(viewportCenter.y)}. Place any new objects near this point.`
              }
              return msg
            })(),
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      },
      {
        langsmithExtra: {
          metadata: { boardId, userId: user.id },
          tags: ['ai-interpret', 'collabboard'],
        },
      }
    )

    const usage = completion.usage
    console.log('[ai-interpret] usage', { prompt_tokens: usage?.prompt_tokens, completion_tokens: usage?.completion_tokens, total_tokens: usage?.total_tokens })

    const content = completion.choices?.[0]?.message?.content
    if (!content) {
      return new Response(JSON.stringify({ error: 'No response from OpenAI.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const parsed = JSON.parse(content) as { commands?: unknown[] }
    if (!Array.isArray(parsed.commands)) {
      return new Response(JSON.stringify({ error: 'Invalid AI response format.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({
        commands: parsed.commands,
        usage: usage ? { prompt_tokens: usage.prompt_tokens, completion_tokens: usage.completion_tokens, total_tokens: usage.total_tokens } : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
