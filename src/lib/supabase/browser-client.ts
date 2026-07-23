import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

// Anon/publishable key only — safe to ship in the browser bundle, Row Level
// Security in Postgres is what actually protects the data. Used client-side
// only to read the `companies_public` view (id/short_code/name) for the
// pre-login company search box. We never persist a Supabase auth session
// here; login state is tracked via our own httpOnly session cookies.
export const supabaseBrowser = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
)
