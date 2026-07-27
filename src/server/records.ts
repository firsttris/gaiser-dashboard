import { createServerFn } from '@tanstack/react-start'
import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'
import { getServiceSupabaseClient } from '#/lib/supabase/service-client.server'
import { requireAdminSession } from './middleware/require-admin-session'
import { requireAnySession } from './auth-context'
import { findOrCreateConstructionSite } from './construction-sites'
import { formatGeneratedNumber } from '#/utils/numbering-format'
import type { PriceCategory, RecordRow } from '#/lib/supabase/types'

const createRecordSchema = z.object({
  type: z.enum(['pickup', 'dropoff']),
  productId: z.number(),
  amount: z.number().positive(),
  constructionSiteName: z.string(),
  companyId: z.string().uuid().optional(),
})

const createTruckRecordSchema = z.object({
  truckId: z.number(),
  hours: z.number().positive(),
  constructionSiteName: z.string(),
  companyId: z.string().uuid().optional(),
})

const updateStatusSchema = z.object({
  recordId: z.number(),
  status: z.enum(['offen', 'lieferschein', 'rechnung', 'bezahlt', 'storniert']),
})

const assignInvoiceSchema = z.object({
  recordIds: z.array(z.number()),
  invoiceId: z.string(),
  reverseCharge: z.boolean().optional(),
})

const assignCancelSchema = z.object({
  recordIds: z.array(z.number()),
  cancelId: z.string(),
})

function toRecord(row: RecordRow) {
  return {
    id: row.id,
    company: row.company_name,
    constructionSiteId: row.construction_site_id ?? '',
    constructionSiteName: row.construction_site_name,
    type: row.type,
    productName: row.product_name,
    amount: row.amount,
    unit: row.unit,
    unitPrice: row.unit_price,
    total: row.total,
    status: row.status,
    createdAt: new Date(row.created_at).toLocaleString('de-DE'),
    deliveryNoteId: row.delivery_note_id ?? undefined,
    invoiceId: row.invoice_id ?? undefined,
    invoiceReverseCharge: row.invoice_reverse_charge,
    cancelId: row.cancel_id ?? undefined,
  }
}

function productUnitPrice(
  product: { pickup_private_price: number; pickup_business_price: number; dropoff_private_price: number; dropoff_business_price: number },
  type: 'pickup' | 'dropoff',
  priceCategory: PriceCategory,
) {
  if (type === 'pickup') {
    return priceCategory === 'private' ? product.pickup_private_price : product.pickup_business_price
  }
  return priceCategory === 'private' ? product.dropoff_private_price : product.dropoff_business_price
}

// Resolves which company a dual-mode call may act on. Customers can only
// ever create records for their own company — any companyId they send is
// ignored. Admins must explicitly say which company the record is for.
async function resolveActingCompanyId(companyIdFromCaller: string | undefined) {
  const caller = await requireAnySession()
  if (caller.role === 'customer') return caller.companyId
  return companyIdFromCaller ?? null
}

export const createRecord = createServerFn({ method: 'POST' })
  .validator((data: unknown) => createRecordSchema.parse(data))
  .handler(async ({ data }) => {
    const companyId = await resolveActingCompanyId(data.companyId)
    if (!companyId) return null

    const supabase = getServiceSupabaseClient()

    const [{ data: company }, { data: product }] = await Promise.all([
      supabase.from('companies').select('id, name, price_category').eq('id', companyId).maybeSingle(),
      supabase.from('products').select('*').eq('id', data.productId).maybeSingle(),
    ])
    if (!company || !product) return null

    const site = await findOrCreateConstructionSite(supabase, data.constructionSiteName)
    if (!site) return null

    const unitPrice = productUnitPrice(product, data.type, company.price_category)
    const total = unitPrice * data.amount

    const { data: numbering, error: numberingError } = await supabase.rpc('next_delivery_note_number')
    const numberingRow = numbering?.[0]
    if (numberingError || !numberingRow) return null
    const deliveryNoteId = formatGeneratedNumber(numberingRow.template, numberingRow.counter, numberingRow.padding)

    const { data: inserted, error } = await supabase
      .from('records')
      .insert({
        company_id: company.id,
        company_name: company.name,
        construction_site_id: site.id,
        construction_site_name: site.name,
        type: data.type,
        product_name: product.name,
        amount: data.amount,
        unit: product.unit,
        unit_price: unitPrice,
        total,
        status: 'lieferschein',
        delivery_note_id: deliveryNoteId,
        invoice_reverse_charge: false,
      })
      .select('*')
      .single()

    if (error || !inserted) return null
    return toRecord(inserted)
  })

export const createTruckRecord = createServerFn({ method: 'POST' })
  .validator((data: unknown) => createTruckRecordSchema.parse(data))
  .handler(async ({ data }) => {
    const companyId = await resolveActingCompanyId(data.companyId)
    if (!companyId) return null

    const supabase = getServiceSupabaseClient()

    const [{ data: company }, { data: truck }] = await Promise.all([
      supabase.from('companies').select('id, name, price_category').eq('id', companyId).maybeSingle(),
      supabase.from('trucks').select('*').eq('id', data.truckId).maybeSingle(),
    ])
    if (!company || !truck) return null

    const site = await findOrCreateConstructionSite(supabase, data.constructionSiteName)
    if (!site) return null

    const unitPrice = company.price_category === 'private' ? truck.private_price : truck.business_price
    const total = unitPrice * data.hours

    const { data: numbering, error: numberingError } = await supabase.rpc('next_delivery_note_number')
    const numberingRow = numbering?.[0]
    if (numberingError || !numberingRow) return null
    const deliveryNoteId = formatGeneratedNumber(numberingRow.template, numberingRow.counter, numberingRow.padding)

    const { data: inserted, error } = await supabase
      .from('records')
      .insert({
        company_id: company.id,
        company_name: company.name,
        construction_site_id: site.id,
        construction_site_name: site.name,
        type: 'lkw',
        product_name: truck.name,
        amount: data.hours,
        unit: 'Std.',
        unit_price: unitPrice,
        total,
        status: 'lieferschein',
        delivery_note_id: deliveryNoteId,
        invoice_reverse_charge: false,
      })
      .select('*')
      .single()

    if (error || !inserted) return null
    return toRecord(inserted)
  })

export const listRecords = createServerFn({ method: 'GET' }).handler(async () => {
  const caller = await requireAnySession()
  const supabase = getServiceSupabaseClient()

  const query = supabase.from('records').select('*').order('id', { ascending: false })
  const { data, error } =
    caller.role === 'admin' ? await query : await query.eq('company_id', caller.companyId)

  if (error || !data) return []
  return data.map(toRecord)
})

export const updateRecordStatus = createServerFn({ method: 'POST' })
  .middleware([requireAdminSession])
  .validator((data: unknown) => updateStatusSchema.parse(data))
  .handler(async ({ data, context }) => {
    await context.supabase.from('records').update({ status: data.status }).eq('id', data.recordId)
  })

export const assignInvoice = createServerFn({ method: 'POST' })
  .middleware([requireAdminSession])
  .validator((data: unknown) => assignInvoiceSchema.parse(data))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from('records')
      .update({ invoice_id: data.invoiceId, invoice_reverse_charge: data.reverseCharge ?? false })
      .in('id', data.recordIds)
  })

export const assignCancel = createServerFn({ method: 'POST' })
  .middleware([requireAdminSession])
  .validator((data: unknown) => assignCancelSchema.parse(data))
  .handler(async ({ data, context }) => {
    await context.supabase.from('records').update({ cancel_id: data.cancelId }).in('id', data.recordIds)
  })

export const recordsQueryOptions = () =>
  queryOptions({
    queryKey: ['records'] as const,
    queryFn: () => listRecords(),
  })
