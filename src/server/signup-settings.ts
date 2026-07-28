import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { getServiceSupabaseClient } from '#/lib/supabase/service-client.server'
import { requireAdminSession } from './middleware/require-admin-session'
import { PIN_HASH_ROUNDS } from './companies'
import { checkAndConsumeMasterPin } from './master-pin.server'

const setMasterPinSchema = z.object({
  pin: z.string().regex(/^\d{4}$/),
})

const verifyMasterPinSchema = z.object({
  masterPin: z.string().regex(/^\d{4}$/),
})

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
