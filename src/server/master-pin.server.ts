import bcrypt from 'bcryptjs'
import { getServiceSupabaseClient } from '#/lib/supabase/service-client.server'

const MAX_ATTEMPTS = 5
const LOCKOUT_MINUTES = 15

// Plain helper (not a createServerFn), shared between verifySignupMasterPin
// (the step-1 gate check on /registrieren) and customerSignUp (which
// re-checks it server-side before actually creating an account, since a
// client could otherwise skip step 1 entirely and call the signup function
// directly). Lives in its own .server.ts file — unlike signup-settings.ts,
// it isn't imported by any client-visible module, so this file's
// service-client.server import can't leak into the client bundle.
export async function checkAndConsumeMasterPin(
  masterPin: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = getServiceSupabaseClient()

  const { data: settings } = await supabase
    .from('signup_settings')
    .select('master_pin_hash, failed_pin_attempts, pin_locked_until')
    .eq('id', true)
    .maybeSingle()

  if (!settings) {
    return { ok: false, message: 'Registrierung ist derzeit nicht verfügbar.' }
  }

  if (settings.pin_locked_until && new Date(settings.pin_locked_until) > new Date()) {
    return { ok: false, message: 'Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen.' }
  }

  const validMasterPin = await bcrypt.compare(masterPin, settings.master_pin_hash)

  if (!validMasterPin) {
    const nextAttempts = settings.failed_pin_attempts + 1
    const lockedUntil =
      nextAttempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString() : null

    await supabase
      .from('signup_settings')
      .update({ failed_pin_attempts: lockedUntil ? 0 : nextAttempts, pin_locked_until: lockedUntil })
      .eq('id', true)

    return { ok: false, message: 'Master-PIN ist ungültig.' }
  }

  await supabase.from('signup_settings').update({ failed_pin_attempts: 0, pin_locked_until: null }).eq('id', true)

  return { ok: true }
}
