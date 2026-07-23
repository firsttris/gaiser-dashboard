import { createServerFn } from '@tanstack/react-start'
import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { getServiceSupabaseClient } from '#/lib/supabase/service-client.server'
import { getCustomerSession, setCustomerSession, clearCustomerSession } from './session'

const MAX_ATTEMPTS = 5
const LOCKOUT_MINUTES = 15
const GENERIC_ERROR = { ok: false, message: 'Firma oder PIN ist ungültig.' } as const

const signInSchema = z.object({
  companyId: z.string().uuid(),
  pin: z.string().regex(/^\d{4}$/),
})

function toPublicCompany(company: {
  id: string
  short_code: string
  name: string
  customer_number: string
  street: string
  postal_code: string
  city: string
  price_category: 'private' | 'business'
}) {
  return {
    id: company.id,
    shortCode: company.short_code,
    name: company.name,
    customerNumber: company.customer_number,
    street: company.street,
    postalCode: company.postal_code,
    city: company.city,
    priceCategory: company.price_category,
  }
}

export const customerSignIn = createServerFn({ method: 'POST' })
  .validator((data: unknown) => signInSchema.parse(data))
  .handler(async ({ data }) => {
    const supabase = getServiceSupabaseClient()
    const { data: company } = await supabase
      .from('companies')
      .select(
        'id, short_code, name, customer_number, street, postal_code, city, price_category, pin_hash, failed_pin_attempts, pin_locked_until',
      )
      .eq('id', data.companyId)
      .maybeSingle()

    if (!company) {
      return GENERIC_ERROR
    }

    if (company.pin_locked_until && new Date(company.pin_locked_until) > new Date()) {
      return { ok: false, message: 'Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen.' } as const
    }

    const valid = await bcrypt.compare(data.pin, company.pin_hash)

    if (!valid) {
      const nextAttempts = company.failed_pin_attempts + 1
      const lockedUntil =
        nextAttempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString() : null

      await supabase
        .from('companies')
        .update({
          failed_pin_attempts: lockedUntil ? 0 : nextAttempts,
          pin_locked_until: lockedUntil,
        })
        .eq('id', company.id)

      return GENERIC_ERROR
    }

    await supabase.from('companies').update({ failed_pin_attempts: 0, pin_locked_until: null }).eq('id', company.id)
    await setCustomerSession({ companyId: company.id, loggedInAt: Date.now() })

    return { ok: true, company: toPublicCompany(company) } as const
  })

export const customerSignOut = createServerFn({ method: 'POST' }).handler(async () => {
  await clearCustomerSession()
  return { ok: true } as const
})

export const getCustomerSessionStatus = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await getCustomerSession()
  if (!session.data.companyId) {
    return { isLoggedIn: false, company: null } as const
  }

  const supabase = getServiceSupabaseClient()
  const { data: company } = await supabase
    .from('companies')
    .select('id, short_code, name, customer_number, street, postal_code, city, price_category')
    .eq('id', session.data.companyId)
    .maybeSingle()

  if (!company) {
    return { isLoggedIn: false, company: null } as const
  }

  return { isLoggedIn: true, company: toPublicCompany(company) } as const
})

export const customerSessionStatusQueryOptions = () =>
  queryOptions({
    queryKey: ['auth', 'customer'] as const,
    queryFn: () => getCustomerSessionStatus(),
  })
