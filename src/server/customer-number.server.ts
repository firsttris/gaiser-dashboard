import { getServiceSupabaseClient } from '#/lib/supabase/service-client.server'
import { formatGeneratedNumber } from '#/utils/numbering-format'

const CUSTOMER_NUMBER_TEMPLATE = 'K-{NUMMER}'
const CUSTOMER_NUMBER_PADDING = 4

// Plain helper (not a createServerFn) called from adminCreateCompany's and
// customerSignUp's own handlers to assign a customer number at creation
// time, same atomic-counter approach as the invoice/delivery-note numbers.
// Lives in its own .server.ts file — unlike numbering.ts, it isn't imported
// by any client-visible module, so this file's service-client.server import
// can't leak into the client bundle.
export async function generateCustomerNumber(): Promise<string> {
  const supabase = getServiceSupabaseClient()
  const { data, error } = await supabase.rpc('next_customer_number')
  const row = data?.[0]
  if (error || !row) {
    throw new Error('Kundennummer konnte nicht erzeugt werden.')
  }

  return formatGeneratedNumber(CUSTOMER_NUMBER_TEMPLATE, row.counter, CUSTOMER_NUMBER_PADDING)
}
