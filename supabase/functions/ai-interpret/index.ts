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

const SYSTEM_PROMPT = `You are a canvas assistant for CollabBoard. The user gives natural language instructions about drawing objects or creating templates on a whiteboard.

You respond with a JSON object: { "commands": [...] }. Each command is executed in order.

PRIMARY: createObject — For requests like "draw X", "add a Y", "create Z" (non-template):
{ "action": "createObject", "type": "rect"|"circle"|"triangle"|"line"|"text"|"sticky", "props": { "left": number, "top": number, "width"?: number, "height"?: number, "fill"?: string, "stroke"?: string, "strokeWeight"?: number, "text"?: string, "fontSize"?: number } }
- type: rect, circle, triangle, line, text, or sticky (lowercase)
- left, top: position in pixels. If viewport center is provided, place objects near it. Otherwise default to 100,100.
- width, height: optional, default ~80x60 for shapes
- fill: hex color. Common: blue #3b82f6, red #ef4444, green #10b981, yellow #fef08a, purple #8b5cf6
- text: for "text" and "sticky" types
- strokeWeight: 1-8

OTHER: queryObjects finds objects; deleteObjects removes by id; updateObject changes properties.

LAYOUT COMMANDS — use when the user asks to rearrange or space existing objects:
{ "action": "arrangeInGrid", "objectIds": string[], "cols": number }
{ "action": "spaceEvenly", "objectIds": string[], "direction": "horizontal"|"vertical" }

SELECTION CONTEXT — when the user says "these", "them", "selected", etc., they mean the selected objects. Their IDs will be provided as selectedObjectIds in the request.

TEMPLATE DETECTION — when the user asks for any of these known templates, return a SINGLE command:
{ "action": "applyTemplate", "templateId": "swot"|"pros-cons"|"user-journey"|"retrospective" }
The client handles ALL layout and placement. Do NOT emit createObject commands for template requests.

Template trigger phrases:
- "pros and cons" / "pros cons" → templateId: "pros-cons"
- "SWOT" / "SWOT analysis" / "4 quadrant" → templateId: "swot"
- "user journey" / "journey map" → templateId: "user-journey"
- "retrospective" / "retro" / "what went well" → templateId: "retrospective"

Return only valid JSON. No markdown. Example: { "commands": [{ "action": "createObject", "type": "rect", "props": { "left": 150, "top": 100, "width": 80, "height": 60, "fill": "#3b82f6" } }] }`

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

    // Must pass token explicitly — Edge Functions have no session storage
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) {
      return new Response(JSON.stringify({ error: 'Must be signed in.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

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

    const { data: board } = await supabase.from('boards').select('id').eq('id', boardId).single()
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

    const openai = wrapOpenAI(new OpenAI({ apiKey }))
    const completion = await openai.chat.completions.create(
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
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

    return new Response(JSON.stringify({ commands: parsed.commands }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
