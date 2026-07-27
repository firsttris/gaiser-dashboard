import { createMiddleware } from '@tanstack/react-start'
import { createAuthedSupabaseClient, getPublishableSupabaseClient } from '#/lib/supabase/auth-client.server'
import { getAdminSession, setAdminSession } from '../session'

const REFRESH_MARGIN_MS = 60_000

export const requireAdminSession = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  const session = await getAdminSession()
  if (
    !session.data.userId ||
    !session.data.accessToken ||
    !session.data.refreshToken ||
    session.data.expiresAt === undefined
  ) {
    throw new Error('UNAUTHENTICATED')
  }

  let { userId, accessToken, refreshToken, expiresAt } = session.data

  if (expiresAt * 1000 < Date.now() + REFRESH_MARGIN_MS) {
    const supabase = getPublishableSupabaseClient()
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken })

    if (error || !data.session) {
      throw new Error('UNAUTHENTICATED')
    }

    accessToken = data.session.access_token
    refreshToken = data.session.refresh_token
    expiresAt = data.session.expires_at ?? 0
    await setAdminSession({ userId, accessToken, refreshToken, expiresAt })
  }

  return next({ context: { supabase: createAuthedSupabaseClient(accessToken), adminUserId: userId } })
})
