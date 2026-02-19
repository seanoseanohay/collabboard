/**
 * pirate-jokes — Supabase Edge Function.
 * Generates 5 fresh pirate jokes/puns per request using OpenAI gpt-4o-mini.
 * No auth required — jokes are public. Cache results client-side by date.
 */

import OpenAI from 'npm:openai@4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYSTEM_PROMPT = `You are a witty pirate parrot mascot named Squawk for MeBoard, a pirate-themed collaborative whiteboard app.

Generate exactly 5 short, funny pirate jokes, puns, or one-liners (1–2 sentences each). Make them silly and punny — the kind a parrot would squawk. Mix in references to pirates, the sea, treasure, ships, and also canvas/drawing/whiteboard things when it fits naturally.

Return ONLY a JSON object with this exact shape: { "jokes": ["...", "...", "...", "...", "..."] }
No markdown. No extra keys. No explanations.`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY not set.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const openai = new OpenAI({ apiKey })
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: SYSTEM_PROMPT }],
      response_format: { type: 'json_object' },
      temperature: 0.95,
    })

    const content = completion.choices?.[0]?.message?.content
    if (!content) {
      return new Response(
        JSON.stringify({ error: 'No response from OpenAI.' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const parsed = JSON.parse(content) as { jokes?: unknown }
    if (!Array.isArray(parsed.jokes) || parsed.jokes.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Unexpected response format from OpenAI.' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const jokes = (parsed.jokes as unknown[])
      .filter((j): j is string => typeof j === 'string' && j.trim().length > 0)
      .slice(0, 5)

    return new Response(JSON.stringify({ jokes }), {
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
