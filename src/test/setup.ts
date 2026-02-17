import '@testing-library/jest-dom'

import { TextEncoder, TextDecoder } from 'util'
import { randomUUID } from 'crypto'
Object.assign(global, { TextEncoder, TextDecoder })
// Polyfill crypto.randomUUID for Jest (Node < 19 or jsdom)
if (!globalThis.crypto) {
  (globalThis as { crypto: { randomUUID: () => string } }).crypto = {
    randomUUID,
  }
} else if (!globalThis.crypto.randomUUID) {
  (globalThis.crypto as { randomUUID: () => string }).randomUUID = randomUUID
}

jest.mock('@/shared/config/env', () => ({
  env: {
    supabaseUrl: 'https://test.supabase.co',
    supabaseAnonKey: 'test-anon-key',
    isDev: true,
  },
}))

jest.mock('@/shared/lib/supabase/config', () => ({
  getSupabaseClient: () => ({
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithOAuth: jest.fn(),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
    },
    from: () => ({
      select: () => ({ eq: () => ({ order: () => ({ data: [], error: null }), single: () => ({ data: null, error: null }), data: [], error: null }), data: [], error: null }),
      insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'mock-id' }, error: null }) }) }),
      upsert: () => Promise.resolve({ data: null, error: null }),
      delete: () => ({ eq: () => ({ eq: () => ({ then: (fn: (r: { error: null }) => void) => { fn({ error: null }); return Promise.resolve() } }) }) }),
    }),
    channel: () => ({
      on: () => ({ subscribe: () => {} }),
    }),
    removeChannel: () => {},
    functions: {
      invoke: () => Promise.resolve({ data: { message: 'OK' }, error: null }),
    },
  }),
}))

jest.mock('@/features/workspace/components/FabricCanvas', () => ({
  FabricCanvas: () =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- mock factory
    require('react').createElement('div', { 'data-testid': 'fabric-canvas-mock' }),
}))
