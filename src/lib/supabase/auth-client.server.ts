import { createServerOnlyFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// Anon/publishable-key client used only to call auth.signInWithPassword /
// auth.refreshSession server-side. Never persists a session locally — the
// caller reads the returned tokens directly and seals them into our own
// httpOnly session cookie.
export const getPublishableSupabaseClient = createServerOnlyFn(() =>
  createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }),
)

// A client that runs PostgREST queries AS the signed-in admin (Postgres role
// `authenticated`, auth.uid() resolves), so Row Level Security is the real
// backstop for admin writes — not a service-role bypass.
export const createAuthedSupabaseClient = createServerOnlyFn((accessToken: string) =>
  createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  }),
)
