/**
 * Invoke the ai-canvas-ops Supabase Edge Function for canvas operations.
 * Use when you want the AI agent to run on the server (e.g. headless or future Claude flow).
 * For in-browser AI, prefer the client-side aiClientApi (createObject, updateObject, etc.).
 */

import { getSupabaseClient } from '@/shared/lib/supabase/config'
import { env } from '@/shared/config/env'
import type { CreateObjectType, CreateObjectProps, UpdateObjectProps, QueryObjectsCriteria } from './aiClientApi'

const FUNCTION_NAME = 'ai-canvas-ops'

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const supabase = getSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('You must be signed in to use the AI canvas Edge Function.')
  }

  const res = await fetch(`${env.supabaseUrl}/functions/v1/${FUNCTION_NAME}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: env.supabaseAnonKey,
    },
    body: JSON.stringify(body),
  })

  const data = (await res.json()) as T & { error?: string }
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Not authorized. Sign in again, or deploy the function: supabase functions deploy ai-canvas-ops')
    }
    throw new Error(data?.error ?? `AI canvas ops failed (${res.status})`)
  }
  return data
}

/** Create object via Edge Function. Returns objectId. */
export async function edgeCreateObject(
  boardId: string,
  type: CreateObjectType,
  props: CreateObjectProps
): Promise<string> {
  const result = await invoke<{ objectId: string }>({
    action: 'createObject',
    boardId,
    type,
    props,
  })
  return result.objectId
}

/** Update object via Edge Function. */
export async function edgeUpdateObject(
  boardId: string,
  objectId: string,
  partialProps: UpdateObjectProps
): Promise<void> {
  await invoke<{ ok: boolean }>({
    action: 'updateObject',
    boardId,
    objectId,
    partialProps,
  })
}

/** Delete objects via Edge Function. */
export async function edgeDeleteObjects(boardId: string, objectIds: string[]): Promise<void> {
  await invoke<{ ok: boolean }>({
    action: 'deleteObjects',
    boardId,
    objectIds,
  })
}

/** Query objects via Edge Function. */
export async function edgeQueryObjects(
  boardId: string,
  criteria?: QueryObjectsCriteria
): Promise<{ objectId: string; data: Record<string, unknown> }[]> {
  const result = await invoke<{ objects: { objectId: string; data: Record<string, unknown> }[] }>({
    action: 'queryObjects',
    boardId,
    criteria,
  })
  return result.objects
}
