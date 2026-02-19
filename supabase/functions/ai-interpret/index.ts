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

const SYSTEM_PROMPT = `You are a canvas assistant for CollabBoard. The user gives natural language instructions about drawing objects on a whiteboard.

You respond with a JSON object: { "commands": [...] }. Each command is executed in order.

PRIMARY: createObject — For requests like "draw X", "add a Y", "create Z":
{ "action": "createObject", "type": "rect"|"circle"|"triangle"|"line"|"text"|"sticky", "props": { "left": number, "top": number, "width"?: number, "height"?: number, "fill"?: string, "stroke"?: string, "strokeWeight"?: number, "text"?: string, "fontSize"?: number } }
- type: rect, circle, triangle, line, text, or sticky (lowercase)
- left, top: position in pixels (required). Default 100,100 if unclear
- width, height: optional, default ~80x60 for shapes
- fill: hex color. Common: blue #3b82f6, red #ef4444, green #10b981, yellow #fef08a, purple #8b5cf6
- text: for "text" and "sticky" types
- strokeWeight: 1-8

OTHER: queryObjects finds objects; deleteObjects removes by id; updateObject changes properties. Use createObject for most "draw/add/create" requests.

LAYOUT COMMANDS — use these when the user asks to rearrange or space existing objects:
{ "action": "arrangeInGrid", "objectIds": string[], "cols": number }
- Arranges the listed objects into a grid. Use cols to set number of columns (default 3). objectIds must come from the provided selectedObjectIds.

{ "action": "spaceEvenly", "objectIds": string[], "direction": "horizontal"|"vertical" }
- Distributes the listed objects with equal spacing. objectIds from selectedObjectIds.

SELECTION CONTEXT — when the user says "these", "them", "selected", etc., they mean the selected objects. Their IDs will be provided as selectedObjectIds in the request.

GROUPING — always append this as the LAST command of every template:
{ "action": "groupCreated" }
This groups everything created in the template into a single movable unit.

TEMPLATES — for these requests, emit multiple createObject commands using exact layouts below, then append groupCreated:

TEMPLATE: "pros and cons" / "pros cons grid" / "2 by 3 grid of sticky notes for pros and cons"
Emit 8 sticky commands then groupCreated:
- Header sticky "Pros": type:"sticky", text:"Pros", left:100, top:60, width:200, height:50, fill:#dcfce7, stroke:#16a34a, strokeWeight:2
- Header sticky "Cons": type:"sticky", text:"Cons", left:330, top:60, width:200, height:50, fill:#fee2e2, stroke:#dc2626, strokeWeight:2
- 3 blank sticky notes under Pros: left:100, top:130/240/350, width:200, height:90, fill:#f0fdf4
- 3 blank sticky notes under Cons: left:330, top:130/240/350, width:200, height:90, fill:#fef2f2

TEMPLATE: "SWOT analysis" / "SWOT template" / "4 quadrant SWOT"
Emit 8 commands then groupCreated: 4 rect backgrounds + 4 text labels.
- Background rects (width:220, height:200, strokeWeight:2):
  Strengths: left:100, top:100, fill:#dcfce7, stroke:#16a34a
  Weaknesses: left:340, top:100, fill:#fee2e2, stroke:#dc2626
  Opportunities: left:100, top:320, fill:#dbeafe, stroke:#2563eb
  Threats: left:340, top:320, fill:#fef9c3, stroke:#ca8a04
- Text label on each (type:"text", fontSize:15, fill:"#1a1a2e"):
  "Strengths" left:110, top:110
  "Weaknesses" left:350, top:110
  "Opportunities" left:110, top:330
  "Threats" left:350, top:330

TEMPLATE: "user journey map" / "user journey with 5 stages" / "5 stage journey"
Emit 10 commands then groupCreated: 5 header rects + 5 body sticky notes.
- 5 header rects (type:"rect", top:60, width:160, height:40, fill:#dbeafe, stroke:#2563eb, strokeWeight:2) with text prop set to stage name:
  Awareness: left:60   Consideration: left:240   Decision: left:420   Retention: left:600   Advocacy: left:780
- 5 body sticky notes (type:"sticky", top:120, width:160, height:240, fill:#f8fafc):
  left:60, left:240, left:420, left:600, left:780

TEMPLATE: "retrospective" / "retro board" / "what went well what didn't action items"
Emit 6 commands then groupCreated: 3 header rects + 3 body sticky notes.
- Header rects (type:"rect", top:60, width:220, height:44, strokeWeight:2) with text prop set to column name:
  "What Went Well": left:60, fill:#dcfce7, stroke:#16a34a
  "What Didn't": left:300, fill:#fee2e2, stroke:#dc2626
  "Action Items": left:540, fill:#dbeafe, stroke:#2563eb
- Body sticky notes (type:"sticky", top:124, width:220, height:340, fill:#fafafa):
  left:60, left:300, left:540

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

    const body = (await req.json()) as { boardId?: string; prompt?: string; selectedObjectIds?: string[] }
    const { boardId, prompt, selectedObjectIds } = body
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
            content: selectedObjectIds && selectedObjectIds.length > 0
              ? `${prompt}\n\nSelectedObjectIds: ${JSON.stringify(selectedObjectIds)}`
              : prompt,
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
