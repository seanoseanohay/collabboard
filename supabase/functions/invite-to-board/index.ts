import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const resendFrom = Deno.env.get('RESEND_FROM_EMAIL') ?? 'CollabBoard <onboarding@resend.dev>'

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })

    const { data: { user: inviter } } = await supabase.auth.getUser()
    if (!inviter) {
      return new Response(JSON.stringify({ error: 'Must be signed in to invite.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = (await req.json()) as { boardId?: string; email?: string; mode?: 'add' | 'email'; origin?: string }
    const { boardId, email, mode } = body
    if (!boardId || !email || !['add', 'email'].includes(mode ?? '')) {
      return new Response(JSON.stringify({ error: 'boardId, email, and mode (add|email) required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const trimmedEmail = (email as string).trim().toLowerCase()
    if (!trimmedEmail.includes('@')) {
      return new Response(JSON.stringify({ error: 'Valid email required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: board } = await supabase.from('boards').select('id, title').eq('id', boardId).single()
    if (!board) {
      return new Response(JSON.stringify({ error: 'Board not found.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: members } = await supabase.from('board_members').select('user_id').eq('board_id', boardId)
    const isMember = members?.some((m) => m.user_id === inviter.id)
    if (!isMember) {
      return new Response(JSON.stringify({ error: 'You must be a board member to invite others.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (mode === 'add') {
      const adminClient = createClient(supabaseUrl, supabaseServiceKey)
      const { data: listData } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
      const targetUser = listData?.users?.find((u) => u.email?.toLowerCase() === trimmedEmail) ?? null
      if (!targetUser) {
        return new Response(
          JSON.stringify({ error: 'No account found with that email. Use "Send invite email" instead.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const targetUid = targetUser.id
      const existing = members?.some((m) => m.user_id === targetUid)
      if (existing) {
        return new Response(JSON.stringify({ added: true, message: 'User is already a member.' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      await adminClient.from('board_members').insert({ board_id: boardId, user_id: targetUid })
      await adminClient.from('user_boards').insert({
        user_id: targetUid,
        board_id: boardId,
        title: board.title ?? 'Untitled',
      })

      return new Response(JSON.stringify({ added: true, message: 'Collaborator added to board.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: 'Email sending not configured. Set RESEND_API_KEY in Edge Function secrets.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const origin = typeof body.origin === 'string' ? body.origin : 'https://collabboard.example.com'
    const shareUrl = `${origin.replace(/\/$/, '')}/board/${boardId}`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: resendFrom,
        to: trimmedEmail,
        subject: `You're invited to collaborate on "${board.title ?? 'Untitled Board'}"`,
        html: `
          <p>You've been invited to collaborate on a board in CollabBoard.</p>
          <p><a href="${shareUrl}">Open the board</a></p>
          <p>If you don't have an account, sign up first, then use the link above.</p>
        `,
      }),
    })

    const resData = (await res.json()) as { message?: string }
    if (!res.ok) {
      const msg = resData?.message ?? 'Failed to send email'
      const hint = msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('key')
        ? '. Check RESEND_API_KEY at resend.com'
        : ''
      return new Response(JSON.stringify({ error: msg + hint }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ sent: true, message: 'Invite email sent.' }), {
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
