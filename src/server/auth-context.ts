import { getAdminSession, getCustomerSession } from './session'

export type CallerContext = { role: 'admin' } | { role: 'customer'; companyId: string }

// Used by "dual-mode" server functions (products/trucks/construction-sites
// catalog reads, record creation) that any logged-in principal may call —
// admin or customer — but customers have no Supabase Auth identity to scope
// via RLS, so the caller's identity is resolved here and the calling
// function is responsible for scoping its own queries accordingly.
export async function requireAnySession(): Promise<CallerContext> {
  const adminSession = await getAdminSession()
  if (adminSession.data.userId) {
    return { role: 'admin' }
  }

  const customerSession = await getCustomerSession()
  if (customerSession.data.companyId) {
    return { role: 'customer', companyId: customerSession.data.companyId }
  }

  throw new Error('UNAUTHENTICATED')
}
