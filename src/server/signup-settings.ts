import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { getServiceSupabaseClient } from '#/lib/supabase/service-client.server'
import { requireAdminSession } from './middleware/require-admin-session'
import { PIN_HASH_ROUNDS } from './companies'

const MAX_ATTEMPTS = 5
const LOCKOUT_MINUTES = 15

const setMasterPinSchema = z.object({
  pin: z.string().regex(/^\d{4}$/),
})

const verifyMasterPinSchema = z.object({
  masterPin: z.string().regex(/^\d{4}$/),
})

// Shared between verifySignupMasterPin (the step-1 gate check on
// /registrieren) and customerSignUp (which re-checks it server-side before
// actually creating an account, since a client could otherwise skip step 1
// entirely and call the signup function directly).
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

// Public step-1 gate on /registrieren: verifies the master PIN on its own,
// before the customer ever sees the account-creation form.
export const verifySignupMasterPin = createServerFn({ method: 'POST' })
  .validator((data: unknown) => verifyMasterPinSchema.parse(data))
  .handler(async ({ data }) => checkAndConsumeMasterPin(data.masterPin))

// Admin-triggered, but writes via the service-role client rather than the
// RLS-scoped admin client — signup_settings has no RLS grants for
// authenticated at all (see the create_signup_settings migration), so the
// surrounding requireAdminSession check is what gates this, same as
// generateInvoiceNumber in numbering.ts.
export const adminSetMasterPin = createServerFn({ method: 'POST' })
  .middleware([requireAdminSession])
  .validator((data: unknown) => setMasterPinSchema.parse(data))
  .handler(async ({ data }) => {
    const supabase = getServiceSupabaseClient()
    const pinHash = await bcrypt.hash(data.pin, PIN_HASH_ROUNDS)

    const { error } = await supabase
      .from('signup_settings')
      .update({ master_pin_hash: pinHash, failed_pin_attempts: 0, pin_locked_until: null })
      .eq('id', true)

    if (error) {
      return { ok: false, message: 'Die Master-PIN konnte nicht geändert werden.' } as const
    }

    return { ok: true } as const
  })
