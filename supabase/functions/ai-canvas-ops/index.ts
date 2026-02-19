/**
 * AI Canvas Ops — Supabase Edge Function for canvas operations.
 * Mirrors aiClientApi: createObject, updateObject, deleteObjects, queryObjects.
 * Uses request JWT so RLS applies (caller must be board member).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const VALID_TYPES = ['rect', 'circle', 'triangle', 'line', 'text', 'sticky'] as const
type CreateType = (typeof VALID_TYPES)[number]

const DEFAULT_FILL = '#fff'
const DEFAULT_STROKE = '#1a1a2e'
const DEFAULT_STROKE_WEIGHT = 2

/** Build minimal Fabric 7–compatible serialized payload for createObject. Client applies via enlivenObjects. */
function buildCreatePayload(
  type: CreateType,
  props: {
    left?: number
    top?: number
    width?: number
    height?: number
    fill?: string
    stroke?: string
    strokeWeight?: number
    text?: string
    fontSize?: number
  }
): Record<string, unknown> {
  const left = props.left ?? 0
  const top = props.top ?? 0
  const width = Math.max(1, props.width ?? 100)
  const height = Math.max(1, props.height ?? 80)
  const fill = props.fill ?? DEFAULT_FILL
  const stroke = props.stroke ?? DEFAULT_STROKE
  const strokeWidth = props.strokeWeight ?? DEFAULT_STROKE_WEIGHT
  const base: Record<string, unknown> = {
    originX: 'left',
    originY: 'top',
    stroke,
    strokeWidth,
    scaleX: 1,
    scaleY: 1,
    angle: 0,
  }

  switch (type) {
    case 'rect':
      return { type: 'Rect', left, top, width, height, fill, ...base }
    case 'circle': {
      const r = Math.min(width, height) / 2
      return { type: 'Circle', left: left + width / 2 - r, top: top + height / 2 - r, radius: r, fill, ...base }
    }
    case 'triangle':
      return { type: 'Triangle', left, top, width, height, fill, ...base }
    case 'line': {
      return {
        type: 'Path',
        path: [['M', 0, 0], ['L', width, height]],
        fill: '',
        left,
        top,
        ...base,
      }
    }
    case 'text':
      return {
        type: 'IText',
        left,
        top,
        text: props.text ?? 'Text',
        fontSize: props.fontSize ?? 16,
        fill: DEFAULT_STROKE,
        editable: true,
        ...base,
      }
    case 'sticky': {
      const stickyFill = fill !== DEFAULT_FILL ? fill : '#fef08a'
      const padding = 8
      const fontSize = Math.max(10, Math.round(Math.min(width, height) * 0.18))
      const bg = { type: 'Rect', left: 0, top: 0, width, height, fill: stickyFill, stroke, strokeWidth: 1, originX: 'left', originY: 'top', scaleX: 1, scaleY: 1, angle: 0 }
      const mainText = { type: 'IText', left: padding, top: padding, text: props.text ?? '', fontSize, fill: DEFAULT_STROKE, originX: 'left', originY: 'top', editable: true, scaleX: 1, scaleY: 1, angle: 0 }
      return { type: 'Group', left, top, objects: [bg, mainText], originX: 'left', originY: 'top', scaleX: 1, scaleY: 1, angle: 0 }
    }
    default:
      return { type: 'Rect', left, top, width, height, fill, ...base }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Must be signed in.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = (await req.json()) as {
      action?: string
      boardId?: string
      type?: string
      props?: Record<string, unknown>
      objectId?: string
      objectIds?: string[]
      partialProps?: Record<string, unknown>
      criteria?: { type?: string; fill?: string }
    }

    const { action, boardId } = body
    if (!boardId || typeof boardId !== 'string') {
      return new Response(JSON.stringify({ error: 'boardId is required.' }), {
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
      return new Response(JSON.stringify({ error: 'Must be a board member to perform canvas operations.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const now = new Date().toISOString()

    switch (action) {
      case 'createObject': {
        const type = body.type as string | undefined
        const props = (body.props ?? {}) as Record<string, unknown>
        if (!type || !VALID_TYPES.includes(type as CreateType)) {
          return new Response(JSON.stringify({ error: `type must be one of: ${VALID_TYPES.join(', ')}` }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        const objectId = crypto.randomUUID()
        const payload = buildCreatePayload(type as CreateType, {
          left: props.left as number | undefined,
          top: props.top as number | undefined,
          width: props.width as number | undefined,
          height: props.height as number | undefined,
          fill: props.fill as string | undefined,
          stroke: props.stroke as string | undefined,
          strokeWeight: props.strokeWeight as number | undefined,
          text: props.text as string | undefined,
          fontSize: props.fontSize as number | undefined,
        })
        ;(payload as Record<string, unknown>).zIndex = Date.now()
        const { error } = await supabase.from('documents').upsert(
          { board_id: boardId, object_id: objectId, data: payload, updated_at: now },
          { onConflict: 'board_id,object_id' }
        )
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        return new Response(JSON.stringify({ objectId }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'updateObject': {
        const objectId = body.objectId as string | undefined
        const partialProps = (body.partialProps ?? {}) as Record<string, unknown>
        if (!objectId) {
          return new Response(JSON.stringify({ error: 'objectId is required for updateObject.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        const { data: row } = await supabase
          .from('documents')
          .select('data')
          .eq('board_id', boardId)
          .eq('object_id', objectId)
          .maybeSingle()
        const current = (row?.data as Record<string, unknown>) ?? null
        if (!current) {
          return new Response(JSON.stringify({ error: `Object not found: ${objectId}` }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        const merged = { ...current, ...partialProps }
        if (partialProps.strokeWeight != null) merged.strokeWidth = partialProps.strokeWeight
        const { error } = await supabase.from('documents').upsert(
          { board_id: boardId, object_id: objectId, data: merged, updated_at: now },
          { onConflict: 'board_id,object_id' }
        )
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'deleteObjects': {
        const objectIds = body.objectIds as string[] | undefined
        if (!Array.isArray(objectIds) || objectIds.length === 0) {
          return new Response(JSON.stringify({ error: 'objectIds (non-empty array) is required for deleteObjects.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        const { error } = await supabase
          .from('documents')
          .delete()
          .eq('board_id', boardId)
          .in('object_id', objectIds)
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'queryObjects': {
        const criteria = body.criteria as { type?: string; fill?: string } | undefined
        let query = supabase
          .from('documents')
          .select('object_id, data')
          .eq('board_id', boardId)
          .order('object_id', { ascending: true })
          .limit(500)
        if (criteria?.type) {
          query = query.eq('data->>type', criteria.type)
        }
        if (criteria?.fill) {
          query = query.eq('data->>fill', criteria.fill)
        }
        const { data: rows, error } = await query
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        const results = (rows ?? [])
          .filter((r): r is { object_id: string; data: Record<string, unknown> } => !!r?.object_id && !!r.data)
          .map((r) => ({ objectId: r.object_id, data: r.data }))
        return new Response(JSON.stringify({ objects: results }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      default:
        return new Response(
          JSON.stringify({ error: `action must be one of: createObject, updateObject, deleteObjects, queryObjects` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
