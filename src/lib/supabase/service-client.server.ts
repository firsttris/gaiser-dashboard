import { createServerOnlyFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

// Service-role client. Bypasses Row Level Security entirely — only ever call
// this from inside a server function handler, never from anything a client
// component could import. `createServerOnlyFn` throws if this somehow runs
// in the browser bundle.
export const getServiceSupabaseClient = createServerOnlyFn(() => {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY

  if (!key) {
    throw new Error('SUPABASE_SECRET_KEY is not set')
  }

  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
})
